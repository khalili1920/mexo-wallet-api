const {
    Address,
    Cell,
    contractAddress,
    loadStateInit,
    domainSignVerify,
    WalletContractV1R1,
    WalletContractV1R2,
    WalletContractV1R3,
    WalletContractV2R1,
    WalletContractV2R2,
    WalletContractV3R1,
    WalletContractV3R2,
    WalletContractV4,
    WalletContractV5R1
} = require("@ton/ton");

const {
    sha256
} = require("@ton/crypto");

const {
    Buffer
} = require("buffer");


const TON_PROOF_PREFIX = "ton-proof-item-v2/";

const TON_CONNECT_PREFIX = "ton-connect";

const MAX_PROOF_AGE = 15 * 60;



function getSignatureDomain(network) {

    if (network === "-239" || network === "-3") {

        return {
            type: "empty"
        };

    }

    return {
        type: "l2",
        globalId: Number(network)
    };

}



function loadV1(slice) {

    slice.loadUint(32);

    return slice.loadBuffer(32);

}



function loadV2(slice) {

    slice.loadUint(32);

    return slice.loadBuffer(32);

}



function loadV3(slice) {

    slice.loadUint(32);

    slice.loadUint(32);

    return slice.loadBuffer(32);

}



function loadV4(slice) {

    slice.loadUint(32);

    slice.loadUint(32);

    return slice.loadBuffer(32);

}



function loadV5(slice) {

    slice.loadBoolean();

    slice.loadUint(32);

    slice.loadUint(32);

    return slice.loadBuffer(32);

}



function buildKnownWallets() {

    const wallets = [

        {
            contract: WalletContractV1R1,
            loader: loadV1
        },

        {
            contract: WalletContractV1R2,
            loader: loadV1
        },

        {
            contract: WalletContractV1R3,
            loader: loadV1
        },

        {
            contract: WalletContractV2R1,
            loader: loadV2
        },

        {
            contract: WalletContractV2R2,
            loader: loadV2
        },

        {
            contract: WalletContractV3R1,
            loader: loadV3
        },

        {
            contract: WalletContractV3R2,
            loader: loadV3
        },

        {
            contract: WalletContractV4,
            loader: loadV4
        },

        {
            contract: WalletContractV5R1,
            loader: loadV5
        }

    ];


    return wallets.map(item => ({

        code: item.contract.create({

            workchain: 0,

            publicKey: Buffer.alloc(32)

        }).init.code,

        loader: item.loader

    }));

}



function tryExtractPublicKey(stateInit) {

    if (!stateInit.code || !stateInit.data) {

        return null;

    }


    const wallets = buildKnownWallets();


    for (const wallet of wallets) {

        try {

            if (wallet.code.equals(stateInit.code)) {

                return wallet.loader(
                    stateInit.data.beginParse()
                );

            }

        } catch (error) {

            continue;

        }

    }


    return null;

}



function buildProofDigest(address, proof) {

    const workchain = Buffer.alloc(4);

    workchain.writeInt32BE(
        address.workChain,
        0
    );


    const domainBytes =
        Buffer.from(
            proof.domain.value,
            "utf8"
        );


    if (
        proof.domain.lengthBytes !==
        domainBytes.length
    ) {

        throw new Error(
            "Domain length mismatch"
        );

    }


    const timestamp = Buffer.alloc(8);

    timestamp.writeBigUInt64LE(
        BigInt(proof.timestamp)
    );


    const message = Buffer.concat([

        Buffer.from(
            TON_PROOF_PREFIX,
            "utf8"
        ),

        workchain,

        address.hash,

        (() => {

            const length = Buffer.alloc(4);

            length.writeUInt32LE(
                domainBytes.length
            );

            return length;

        })(),

        domainBytes,

        timestamp,

        Buffer.from(
            proof.payload,
            "utf8"
        )

    ]);


    const messageHash =
        Buffer.from(
            sha256(message)
        );


    const fullMessage =
        Buffer.concat([

            Buffer.from([
                0xff,
                0xff
            ]),

            Buffer.from(
                TON_CONNECT_PREFIX,
                "utf8"
            ),

            messageHash

        ]);


    return Buffer.from(
        sha256(fullMessage)
    );

}



async function verifyTonProof({

    address,

    network,

    publicKey,

    walletStateInit,

    proof,

    expectedPayload,

    expectedDomain

}) {


    if (!address) {

        throw new Error(
            "Wallet address missing"
        );

    }


    if (!network) {

        throw new Error(
            "Network missing"
        );

    }


    if (!publicKey) {

        throw new Error(
            "Public key missing"
        );

    }


    if (!walletStateInit) {

        throw new Error(
            "Wallet state init missing"
        );

    }


    if (!proof) {

        throw new Error(
            "TON Proof missing"
        );

    }



    if (
        proof.payload !==
        expectedPayload
    ) {

        throw new Error(
            "Invalid proof payload"
        );

    }



    if (
        proof.domain.value !==
        expectedDomain
    ) {

        throw new Error(
            "Invalid application domain"
        );

    }



    const now =
        Math.floor(
            Date.now() / 1000
        );


    const timestamp =
        Number(proof.timestamp);


    if (
        !Number.isSafeInteger(timestamp)
    ) {

        throw new Error(
            "Invalid proof timestamp"
        );

    }


    if (
        Math.abs(
            now - timestamp
        ) > MAX_PROOF_AGE
    ) {

        throw new Error(
            "Proof expired"
        );

    }



    const stateInit =
        loadStateInit(

            Cell
                .fromBase64(walletStateInit)
                .beginParse()

        );



    const wantedAddress =
        Address.parse(address);



    const derivedAddress =
        contractAddress(
            wantedAddress.workChain,
            stateInit
        );



    if (
        !derivedAddress.equals(
            wantedAddress
        )
    ) {

        throw new Error(
            "Wallet state does not match address"
        );

    }



    const extractedPublicKey =
        tryExtractPublicKey(
            stateInit
        );


    if (!extractedPublicKey) {

        throw new Error(
            "Unable to extract wallet public key"
        );

    }



    const reportedPublicKey =
        Buffer.from(
            publicKey,
            "hex"
        );


    if (
        !extractedPublicKey.equals(
            reportedPublicKey
        )
    ) {

        throw new Error(
            "Wallet public key mismatch"
        );

    }



    const digest =
        buildProofDigest(
            wantedAddress,
            proof
        );



    const signature =
        Buffer.from(
            proof.signature,
            "base64"
        );



    const valid =
        domainSignVerify({

            data: digest,

            signature,

            publicKey:
                extractedPublicKey,

            domain:
                getSignatureDomain(
                    network
                )

        });



    if (!valid) {

        throw new Error(
            "Invalid TON Proof signature"
        );

    }



    return {

        verified: true,

        address:
            wantedAddress.toString(),

        network,

        publicKey:
            extractedPublicKey.toString(
                "hex"
            )

    };

}



module.exports = {

    verifyTonProof

};
