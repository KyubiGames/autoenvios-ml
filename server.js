import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const CLIENT_ID = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REDIRECT_URI = process.env.ML_REDIRECT_URI;

// ⭐ Guardaremos los tokens en variables simples.
// Si después querés, lo pasamos a base de datos.
let access_token = null;
let refresh_token = null;

// ------------------------------
// 1) INICIAR LOGIN EN MERCADO LIBRE
// ------------------------------
app.get("/auth", (req, res) => {
    const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`;
    return res.redirect(url);
});

// ------------------------------
// 2) RECIBIR CODE Y GENERAR REFRESH TOKEN
// ------------------------------
app.get("/callback", async (req, res) => {
    const code = req.query.code;

    try {
        const response = await axios.post(
            "https://api.mercadolibre.com/oauth/token",
            {
                grant_type: "authorization_code",
                client_id: CLIENT_ID,
