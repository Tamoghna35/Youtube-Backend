
// require dotenv.config({path:"/.env"})

import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: "./env"
})
connectDB()
    .then(() => {
        app.on("ERRR", (error) => {
            console.log("ERRR", error);
            throw error;
        })
        app.listen(process.env.PORT , () => {
            console.log(`Srver listin at  ${process.env.PORT}`);
        })
    })
    .catch((error) => { console.log(`MongoDB connection filed`, error); });







/*
import express from "express"

const app = express();

; (
    async () => {
        try {
            await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
            app.on("ERRR", (error) => {
                console.log("ERRR", error);
                throw error;
            })
            app.listen(process.env.PORT, () => { console.log(`Server listin at port ${process.env.PORT}`); })

        } catch (error) {
            console.log("ERRR:", error);
            throw error;
        }
    }
)()

*/