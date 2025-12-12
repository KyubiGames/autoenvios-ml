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

// Guardamos los tokens en memoria (luego podés pasarlo a DB)
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
// 3) RENOVAR TOKEN AUTOMÁTICAMENTE
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
// 4) WEBHOOK NOTIFICATIONS
// ------------------------------
app.post("/notifications", async (req, res) => {
    console.log("🔔 Notificación recibida:", req.body);

    const topic = req.body.topic;

    if (topic === "orders_v2") {
        const order_id = req.body.resource.split("/")[2];
        console.log("🛒 Nueva compra:", order_id);
        await enviarMensajeAutomatico(order_id);
    }

    res.sendStatus(200);
});

// ------------------------------
// 5) MENSAJES PERSONALIZADOS POR PUBLICACIÓN
// ------------------------------
const mensajesPorPublicacion = {
    // SUPER MARIO
    "MLA2647136094": (buyer) => `
Hola ${buyer.first_name}, ¡muchas gracias por tu compra! 💛

Recordá abrir este mensaje desde una computadora. Desde la app del celular no vas a poder copiar correctamente el enlace.

Para descargar tu kit de *Super Mario*, copiá y pegá este link en tu navegador:

LINK:
https://www.mediafire.com/folder/hq3d89hrpymaw/Kit_Imprimible_Super_Mario

Si necesitás ayuda, escribime por esta mensajería. Respondo siempre dentro de las 24 hs.

Podés ver más diseños acá:
https://listado.mercadolibre.com.ar/_CustId_661848292

¡Gracias nuevamente y que disfrutes tu compra! 🎉
`,

    // SONIC (EJEMPLO)
    "MLA987654321": (buyer) => `
Hola ${buyer.first_name}, gracias por comprar el kit de Sonic 🦔💙

Acá tenés tu enlace de descarga:
https://link-sonic

Cualquier consulta, estoy para ayudarte 😊
`,
};

// ------------------------------
// 6) ENVIAR MENSAJE POST-VENTA
// ------------------------------
async function enviarMensajeAutomatico(order_id) {
    try {
        await renovarToken();

        // Obtener datos de la orden
        const order = await axios.get(
            `https://api.mercadolibre.com/orders/${order_id}`,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        const buyer = order.data.buyer;
        const buyer_id = buyer.id;
        const item_id = order.data.order_items[0].item.id;

        console.log("👤 Comprador:", buyer.first_name);
        console.log("🧾 Producto comprado:", item_id);

        // Buscar mensaje personalizado
        const generarMensaje = mensajesPorPublicacion[item_id];

        if (!generarMensaje) {
            console.log("⚠ No hay mensaje configurado para este item:", item_id);
            return;
        }

        const texto = generarMensaje(buyer);

        // Construir mensaje
        const mensaje = {
            from: { user_id: "me" },
            to: { user_id: buyer_id },
            text: texto
        };

        // Enviar mensaje por ML
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
