const express = require("express");
const cors = require("cors");

const {
    generatePayload,
    verifyTonProof
} = require("../ton-proof");


const app = express();


app.use(cors());

app.use(express.json());



/*
 * Temporary proof sessions.
 *
 * This is intentionally in-memory for development.
 * We will move this to persistent storage before production.
 */

const proofSessions = new Map();


const PROOF_SESSION_TTL =
    5 * 60 * 1000;



/*
 * Remove expired sessions.
 */

function cleanupSessions() {

    const now = Date.now();


    for (
        const [payload, session]
        of proofSessions.entries()
    ) {

        if (
            now - session.createdAt >
            PROOF_SESSION_TTL
        ) {

            proofSessions.delete(
                payload
            );

        }

    }

}



app.get("/", (req, res) => {

    res.json({

        success: true,

        service: "MEXO Wallet API",

        status: "online"

    });

});



/*
 * Create TON Proof payload.
 */

app.post(
    "/api/ton-proof/payload",
    (req, res) => {

        cleanupSessions();


        const payload =
            generatePayload();


        proofSessions.set(
            payload,
            {

                createdAt:
                    Date.now(),

                used: false

            }
        );


        res.json({

            success: true,

            payload,

            expires_in: 300

        });

    }
);



/*
 * Verify TON Proof.
 */

app.post(
    "/api/ton-proof/verify",
    async (req, res) => {

        try {

            cleanupSessions();


            const {

                payload,

                account,

                proof

            } = req.body;



            if (!payload) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Proof payload is required"

                });

            }



            if (!account) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Wallet account is required"

                });

            }



            if (!proof) {

                return res.status(400).json({

                    success: false,

                    error:
                        "TON Proof is required"

                });

            }



            /*
             * Find the payload session.
             */

            const session =
                proofSessions.get(
                    payload
                );



            if (!session) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid or expired payload"

                });

            }



            /*
             * Prevent replay.
             */

            if (session.used) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Proof payload already used"

                });

            }



            /*
             * Domain comes from Environment Variable.
             *
             * This prevents hard-coding the temporary
             * GitHub Pages domain.
             */

            const expectedDomain =
                process.env.MEXO_APP_DOMAIN;



            if (!expectedDomain) {

                return res.status(500).json({

                    success: false,

                    error:
                        "MEXO_APP_DOMAIN is not configured"

                });

            }



            /*
             * Mark payload as used BEFORE
             * cryptographic verification.
             *
             * This prevents repeated attempts
             * with the same nonce.
             */

            session.used = true;



            /*
             * Perform TON Proof verification.
             */

            const result =
                await verifyTonProof({

                    account,

                    proof,

                    expectedPayload:
                        payload,

                    expectedDomain

                });



            /*
             * Successful cryptographic verification.
             */

            proofSessions.delete(
                payload
            );



            return res.json({

                success: true,

                verified:
                    result.verified,

                wallet: {

                    address:
                        result.address,

                    network:
                        result.network,

                    publicKey:
                        result.publicKey

                }

            });



        } catch (error) {

            console.error(
                "TON Proof verification error:",
                error
            );


            return res.status(400).json({

                success: false,

                verified: false,

                error:
                    error.message ||
                    "TON Proof verification failed"

            });

        }

    }
);



module.exports = app;
