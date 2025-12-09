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
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URI
            },
            { headers: { "Content-Type": "application/json" } }
        );

        access_token = response.data.access_token;
        refresh_token = response.data.refresh_token;

        console.log("Tokens guardados correctamente");
        console.log("ACCESS:", access_token);
        console.log("REFRESH:", refresh_token);

        return res.send("Autorización exitosa. Ya podés cerrar esta pestaña.");
    } catch (err) {
        console.error(err.response?.data || err);
        res.status(500).send("Error obteniendo tokens");
    }
});

// ------------------------------
// 3) RENOVAR TOKEN AUTOMÁTICAMENTE CUANDO SE NECESITE
// ------------------------------
async function renovarToken() {
    if (!refresh_token) return;

    try {
        const response = await axios.post(
            "https://api.mercadolibre.com/oauth/token",
            {
                grant_type: "refresh_token",
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: refresh_token
            },
            { headers: { "Content-Type": "application/json" } }
        );

        access_token = response.data.access_token;
        refresh_token = response.data.refresh_token;

        console.log("🔄 Token renovado correctamente");
    } catch (error) {
        console.error("Error renovando token:", error.response?.data || error);
    }
}

// ------------------------------
// 4) RECIBIR NOTIFICACIONES DE MERCADO LIBRE
// ------------------------------
app.post("/notifications", async (req, res) => {
    console.log("🔔 Notificación recibida:", req.body);

    const topic = req.body.topic;

    // Solo nos interesa "orders_v2"
    if (topic === "orders_v2") {
        const order_id = req.body.resource.split("/")[2];
        console.log("🛒 Nueva compra:", order_id);
        await enviarMensajeAutomatico(order_id);
    }

    res.sendStatus(200);
});

// ------------------------------
// 5) ENVIAR MENSAJE POST-VENTA AUTOMÁTICO
// ------------------------------
async function enviarMensajeAutomatico(order_id) {
    try {
        // Renovar token por las dudas
        await renovarToken();

        // 1) Obtener datos de la orden
        const order = await axios.get(
            `https://api.mercadolibre.com/orders/${order_id}`,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        const buyer_id = order.data.buyer.id;

        // 2) Enviar mensaje AUTOMÁTICO al comprador
        const mensaje = {
            from: { user_id: "me" },
            to: { user_id: buyer_id },
            text: "¡Gracias por tu compra! 🎉 Aquí tenés el link de descarga del kit:\n\nhttps://TU_LINK_DE_DESCARGA"
        };

        await axios.post(
            "https://api.mercadolibre.com/messages/packs/send",
            mensaje,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        console.log("📨 Mensaje enviado al comprador");
    } catch (error) {
        console.error("❌ Error enviando mensaje:", error.response?.data || error);
    }
}

// ------------------------------
// SERVIDOR ACTIVO
// ------------------------------
app.get("/", (req, res) => {
    res.send("Servidor funcionando en Render ✔️");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("🔥 Servidor iniciado en Render");
});
