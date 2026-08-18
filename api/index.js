const crypto = require("crypto");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/*
  Temporary in-memory proof storage.

  This is intentionally temporary.
  Before production we will replace it with persistent storage.
*/

const proofRequests = new Map();

const PROOF_TTL_MS = 5 * 60 * 1000;


/*
  Generate a cryptographically secure nonce.
*/

function generateNonce() {
    return crypto.randomBytes(32).toString("hex");
}


/*
  Remove expired proof requests.
*/

function cleanupExpiredRequests() {

    const now = Date.now();

    for (const [nonce, data] of proofRequests.entries()) {

        if (now - data.createdAt > PROOF_TTL_MS) {
            proofRequests.delete(nonce);
        }

    }

}


/*
  API status.
*/

app.get("/", (req, res) => {

    res.json({
        success: true,
        service: "MEXO Wallet API",
        status: "online"
    });

});


/*
  Create a new TON Proof payload.
*/

app.post("/api/ton-proof/payload", (req, res) => {

    cleanupExpiredRequests();

    const nonce = generateNonce();

    proofRequests.set(nonce, {
        createdAt: Date.now()
    });

    res.json({
        success: true,
        payload: nonce,
        expires_in: 300
    });

});


/*
  Verify endpoint.

  IMPORTANT:
  This endpoint currently validates the request structure only.

  Real TON Proof cryptographic verification will be added
  after the production domain and TON Connect configuration
  are finalized.
*/

app.post("/api/ton-proof/verify", async (req, res) => {

    cleanupExpiredRequests();

    const {
        payload,
        address,
        proof
    } = req.body;


    if (!payload) {

        return res.status(400).json({
            success: false,
            error: "Proof payload is required"
        });

    }


    if (!address) {

        return res.status(400).json({
            success: false,
            error: "Wallet address is required"
        });

    }


    if (!proof) {

        return res.status(400).json({
            success: false,
            error: "TON Proof is required"
        });

    }


    const request = proofRequests.get(payload);


    if (!request) {

        return res.status(400).json({
            success: false,
            error: "Invalid or expired proof payload"
        });

    }


    /*
      Payload is one-time use.
    */

    proofRequests.delete(payload);


    /*
      Do NOT mark the wallet as verified yet.

      Cryptographic verification will be performed
      in the next backend step.
    */

    return res.json({

        success: true,

        verified: false,

        status: "proof_received",

        message:
            "Proof received. Cryptographic verification is pending."

    });

});


module.exports = app;
