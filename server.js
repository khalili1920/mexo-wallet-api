require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { saveWallet } = require("./database");

const app = express();

app.use(cors());
app.use(express.json());


// ==========================================
// TELEGRAM SEND MESSAGE
// ==========================================

async function sendTelegramMessage(chatId, text, replyMarkup = null) {

    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.log("TELEGRAM_BOT_TOKEN missing");
        return false;
    }

    if (!chatId) {
        console.log("Telegram chat ID missing");
        return false;
    }

    try {

        const url =
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

        const body = {
            chat_id: chatId,
            text: text
        };

        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }

        const response = await fetch(url, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(body)
        });

        const result = await response.json();

        console.log("Telegram response:", result);

        return result.ok === true;

    } catch (error) {

        console.log(
            "Telegram send error:",
            error.message
        );

        return false;
    }
}


// ==========================================
// ADMIN MESSAGE
// ==========================================

async function sendAdminMessage(message) {

    if (
        !process.env.TELEGRAM_BOT_TOKEN ||
        !process.env.ADMIN_CHAT_ID
    ) {
        console.log("Telegram admin settings missing");
        return;
    }

    try {

        const url =
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

        await fetch(url, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                chat_id:
                    process.env.ADMIN_CHAT_ID,

                text:
                    message,

                parse_mode:
                    "HTML"
            })
        });

    } catch (error) {

        console.log(
            "Telegram admin error:",
            error.message
        );
    }
}


// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

    res.send(
        "MEXO Wallet API is running"
    );

});


// ==========================================
// VERIFY WALLET
// ==========================================

app.post("/verify-wallet", async (req, res) => {

    const {
        telegram_id,
        username,
        wallet_address
    } = req.body;


    // ======================================
    // VALIDATION
    // ======================================

    if (!telegram_id) {

        return res.status(400).json({

            success: false,

            error:
                "Telegram ID required"

        });

    }


    if (!wallet_address) {

        return res.status(400).json({

            success: false,

            error:
                "Wallet address required"

        });

    }


    // ======================================
    // SAVE WALLET
    // ======================================

    try {

        saveWallet({

            telegram_id,

            username,

            wallet_address,

            verified: 1

        });

    } catch (error) {

        console.log(
            "Database error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            error:
                "Could not save wallet"

        });

    }


    // ======================================
    // ADMIN MESSAGE
    // ======================================

    const adminMessage = `
🔐 <b>NEW VERIFIED WALLET</b>

👤 Username:
@${username || "Unknown"}

🆔 Telegram ID:
${telegram_id}

💎 Wallet:
<code>${wallet_address}</code>

✅ Status:
Verified

🕒 Time:
${new Date().toISOString()}
`;


    await sendAdminMessage(
        adminMessage
    );


    // ======================================
    // USER MESSAGE
    // ======================================

    const userMessage = `
💳 WALLET CONNECTED

💎 Wallet:
${wallet_address}

Your wallet has been saved successfully.

👇 Continue your withdrawal.
`;


    const replyMarkup = {

        inline_keyboard: [

            [
                {
                    text:
                        "💸 CONTINUE WITHDRAW",

                    callback_data:
                        "/withdraw_confirm"
                }
            ],

            [
                {
                    text:
                        "⬅️ MAIN MENU",

                    callback_data:
                        "/main_menu"
                }
            ]

        ]

    };


    const userMessageSent =
        await sendTelegramMessage(

            telegram_id,

            userMessage,

            replyMarkup

        );


    // ======================================
    // RESPONSE
    // ======================================

    res.json({

        success: true,

        message:
            "Wallet saved and user notified",

        telegram_message_sent:
            userMessageSent

    });

});


// ==========================================
// START SERVER
// ==========================================

const PORT =
    process.env.PORT || 3000;

app.listen(
    PORT,
    () => {

        console.log(
            `MEXO API running on port ${PORT}`
        );

    }
);
