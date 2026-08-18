const express = require("express");
const cors = require("cors");

const { saveWallet } = require("../database");


const app = express();


app.use(cors());

app.use(express.json());



async function sendAdminMessage(message) {

    try {

        if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.ADMIN_CHAT_ID) {
            console.log("Telegram settings missing");
            return;
        }


        await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {

                method: "POST",

                headers:{
                    "Content-Type":"application/json"
                },

                body:JSON.stringify({

                    chat_id:process.env.ADMIN_CHAT_ID,

                    text:message,

                    parse_mode:"HTML"

                })

            }
        );


    } catch(error){

        console.log(error.message);

    }

}





app.get("/", (req,res)=>{

    res.json({

        status:"MEXO API Online"

    });

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





    await sendAdminMessage(`

🔐 <b>NEW VERIFIED WALLET</b>


👤 User:
${username || "Unknown"}


🆔 Telegram ID:
${telegram_id || "Unknown"}


💎 Wallet:
<code>${wallet_address}</code>


✅ Verified

🕒 ${new Date().toISOString()}

`);





    res.json({

        success:true,

        message:"Wallet saved"

    });


});




module.exports = app;
