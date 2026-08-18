require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { saveWallet } = require("./database");


const app = express();


app.use(cors());

app.use(express.json());



app.get("/", (req,res)=>{

    res.send("MEXO Wallet API is running");

});



app.post("/verify-wallet",(req,res)=>{


    const {

        telegram_id,
        username,
        wallet_address

    } = req.body;



    if(!wallet_address){

        return res.status(400).json({

            error:"Wallet address required"

        });

    }



    saveWallet({

        telegram_id,
        username,
        wallet_address,
        verified:1

    });



    res.json({

        success:true,
        message:"Wallet saved"

    });


});




const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{

console.log(
`MEXO API running on port ${PORT}`
);

});
