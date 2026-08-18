const crypto = require("crypto");

const {
    Address,
    Cell,
    contractAddress,
    domainSignVerify,
    loadStateInit
} = require("@ton/ton");

const {
    sha256
} = require("@ton/crypto");


const TON_PROOF_PREFIX = "ton-proof-item-v2/";
const TON_CONNECT_PREFIX = "ton-connect";

const MAX_PROOF_AGE_SECONDS = 15 * 60;
const MAX_FUTURE_SKEW_SECONDS = 60;


/*
 * Generate a cryptographically secure payload.
 */
function generatePayload() {

    return crypto
        .randomBytes(32)
        .toString("base64url");

}


/*
 * TON network signature domain.
 *
 * Mainnet  = -239
 * Testnet  = -3
 *
 * Other network IDs use their L2 global ID.
 */
function getSignatureDomain(network) {

    if (
        String(network) === "-239" ||
        String(network) === "-3"
    ) {

        return {
            type: "empty"
        };

    }


    const globalId = Number(network);


    if (!Number.isSafeInteger(globalId)) {

        throw new Error(
            "Invalid TON network"
        );

    }


    return {
        type: "l2",
        globalId
    };

}


/*
 * Build the exact message specified by TON Connect.
 */
function buildTonProofMessage(
    account,
    proof
) {

    const address = Address.parse(
        account.address
    );


    const domainBytes = Buffer.from(
        proof.domain.value,
        "utf8"
    );


    if (
        proof.domain.lengthBytes !==
        domainBytes.length
    ) {

        throw new Error(
            "Invalid domain length"
        );

    }


    if (
        domainBytes.length > 128
    ) {

        throw new Error(
            "Domain is too long"
        );

    }


    const payloadBytes = Buffer.from(
        proof.payload,
        "utf8"
    );


    if (
        payloadBytes.length > 128
    ) {

        throw new Error(
            "Proof payload is too long"
        );

    }


    const workchain = Buffer.alloc(4);

    workchain.writeInt32BE(
        address.workChain,
        0
    );


    const domainLength = Buffer.alloc(4);

    domainLength.writeUInt32LE(
        domainBytes.length,
        0
    );


    const timestamp = Buffer.alloc(8);

    timestamp.writeBigUInt64LE(
        BigInt(proof.timestamp),
        0
    );


    return Buffer.concat([

        Buffer.from(
            TON_PROOF_PREFIX,
            "utf8"
        ),

        workchain,

        address.hash,

        domainLength,

        domainBytes,

        timestamp,

        payloadBytes

    ]);

}


/*
 * Build the digest that the Wallet actually signs.
 */
async function buildTonProofDigest(
    account,
    proof
) {

    const message =
        buildTonProofMessage(
            account,
            proof
        );


    const messageHash =
        Buffer.from(
            await sha256(message)
        );


    const fullMessage = Buffer.concat([

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
        await sha256(fullMessage)
    );

}


/*
 * Verify timestamp.
 */
function verifyTimestamp(timestamp) {

    const now =
        Math.floor(
            Date.now() / 1000
        );


    const proofTime =
        Number(timestamp);


    if (
        !Number.isSafeInteger(
            proofTime
        )
    ) {

        throw new Error(
            "Invalid proof timestamp"
        );

    }


    if (
        proofTime >
        now + MAX_FUTURE_SKEW_SECONDS
    ) {

        throw new Error(
            "Proof timestamp is in the future"
        );

    }


    if (
        now - proofTime >
        MAX_PROOF_AGE_SECONDS
    ) {

        throw new Error(
            "Proof has expired"
        );

    }


    return true;

}


/*
 * Verify that walletStateInit produces
 * the same address reported by the Wallet.
 */
function verifyStateInitAddress(
    account
) {

    if (
        !account.walletStateInit
    ) {

        throw new Error(
            "walletStateInit is missing"
        );

    }


    const stateInitCell =
        Cell.fromBase64(
            account.walletStateInit
        );


    const stateInit =
        loadStateInit(
            stateInitCell.beginParse()
        );


    const address =
        Address.parse(
            account.address
        );


    const derivedAddress =
        contractAddress(
            address.workChain,
            stateInit
        );


    if (
        !derivedAddress.equals(
            address
        )
    ) {

        throw new Error(
            "walletStateInit does not match wallet address"
        );

    }


    return stateInit;

}


/*
 * Verify the TON Proof.
 *
 * Public-key extraction is intentionally kept separate
 * because wallet contract versions have different layouts.
 */
async function verifyTonProof({

    account,
    proof,
    expectedPayload,
    expectedDomain

}) {

    if (!account) {

        throw new Error(
            "Wallet account is missing"
        );

    }


    if (!account.address) {

        throw new Error(
            "Wallet address is missing"
        );

    }


    if (!account.chain) {

        throw new Error(
            "Wallet network is missing"
        );

    }


    if (!account.publicKey) {

        throw new Error(
            "Wallet public key is missing"
        );

    }


    if (!account.walletStateInit) {

        throw new Error(
            "Wallet state init is missing"
        );

    }


    if (!proof) {

        throw new Error(
            "TON Proof is missing"
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


    verifyTimestamp(
        proof.timestamp
    );


    /*
     * Make sure the wallet state really belongs
     * to the reported address.
     */
    verifyStateInitAddress(
        account
    );


    /*
     * Build the exact digest specified
     * by TON Connect.
     */
    const digest =
        await buildTonProofDigest(
            account,
            proof
        );


    const signature =
        Buffer.from(
            proof.signature,
            "base64"
        );


    const publicKey =
        Buffer.from(
            account.publicKey,
            "hex"
        );


    if (
        publicKey.length !== 32
    ) {

        throw new Error(
            "Invalid public key"
        );

    }


    if (
        signature.length !== 64
    ) {

        throw new Error(
            "Invalid signature"
        );

    }


    /*
     * Verify Ed25519 signature.
     */
    const valid =
        domainSignVerify({

            data: digest,

            signature,

            publicKey,

            domain:
                getSignatureDomain(
                    account.chain
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
            account.address,

        network:
            account.chain,

        publicKey:
            account.publicKey

    };

}


module.exports = {

    generatePayload,

    verifyTonProof

};
