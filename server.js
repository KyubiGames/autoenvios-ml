import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Variables desde Railway (Environment Variables)
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const PRODUCTO_OBJETIVO = process.env.PRODUCTO_OBJETIVO; // ID del producto del kit

// --- Obtener nuevo access_token usando el refresh_token ---
async function obtenerToken() {
  try {
    const res = await axios.post("https://api.mercadolibre.com/oauth/token", null, {
      params: {
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN
      }
    });

    return res.data.access_token;

  } catch (err) {
    console.error("Error refrescando token:", err.response?.data || err);
    return null;
  }
}

// --- Ruta Webhook ---
app.post("/webhook", async (req, res) => {
  try {
    const notificacion = req.body;

    if (!notificacion.topic || notificacion.topic !== "orders") {
      return res.sendStatus(200);
    }

    const orderId = notificacion.resource.split("/")[2];
    const token = await obtenerToken();

    if (!token) return res.sendStatus(500);

    // Obtener información de la orden
    const order = await axios.get(
      `https://api.mercadolibre.com/orders/${orderId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const producto = order.data.order_items[0];

    // Si NO es el producto objetivo → ignorar
    if (producto.item.id !== PRODUCTO_OBJETIVO) {
      return res.sendStatus(200);
    }

    const buyerId = order.data.buyer.id;
    const sellerId = order.data.seller.id;

    // --- Enviar el mensaje automático ---
    await axios.post(
      "https://api.mercadolibre.com/messages/send",
      {
        from: { user_id: sellerId },
        to: { user_id: buyerId },
        text: {
          plain: {
            message: 
`¡Gracias por tu compra! 🥳  
Aquí tenés el link de descarga de tu kit:

👉 https://tu-link-de-descarga.com

Cualquier duda, estoy para ayudarte.`
          }
        }
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.sendStatus(200);

  } catch (e) {
    console.error("Error en webhook:", e.response?.data || e);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("Autoenvíos Mercado Libre funcionando ✔️");
});

app.listen(3000, () => console.log("🔥 Servidor iniciado en Railway"));
