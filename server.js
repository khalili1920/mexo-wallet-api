require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { saveWallet } = require("./database");


const app = express();


app.use(cors());

app.use(express.json());



// Telegram notification
async function sendAdminMessage(message) {

    try {

        if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.ADMIN_CHAT_ID) {
            console.log("Telegram settings missing");
            return;
        }


        const url =
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;


        await fetch(url, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                chat_id: process.env.ADMIN_CHAT_ID,

                text: message,

                parse_mode: "HTML"

            })

        });


    } catch(error){

        console.log("Telegram error:", error.message);

    }

}




app.get("/", (req,res)=>{

    res.send("MEXO Wallet API is running");

});






app.post("/verify-wallet", async (req,res)=>{


    const {

        telegram_id,

        username,

        wallet_address


    } = req.body;




    if(!wallet_address){

        return res.status(400).json({

            success:false,

            error:"Wallet address required"

        });

    }




    saveWallet({

        telegram_id,

        username,

        wallet_address,

        verified:1

    });






    const adminMessage = `

🔐 <b>NEW VERIFIED WALLET</b>


👤 Username:
${username || "Unknown"}


🆔 Telegram ID:
${telegram_id || "Unknown"}


💎 Wallet:

<code>${wallet_address}</code>


✅ Status:
Verified


🕒 Time:
${new Date().toISOString()}

`;



    await sendAdminMessage(adminMessage);






    res.json({

        success:true,

        message:"Wallet saved and reported"

    });



});






const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{

    console.log(
        `MEXO API running on port ${PORT}`
    );

});
