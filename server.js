const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

const app = express();
app.use(cors());

// ✅ Serve frontend
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
// 🔑 CONFIG (USE ENV ON RENDER)
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
        if (!req.file) return res.status(400).send("No file");

        filePath = req.file.path;
        mp4Path = filePath + ".mp4";

        // 🎥 Convert
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

        // 📤 Send to Telegram
        const form = new FormData();
        form.append("chat_id", CHAT_ID);
        form.append("video", fs.createReadStream(mp4Path));

        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
            form,
            { headers: form.getHeaders() }
        );

        // 🧹 Cleanup
        fs.unlinkSync(filePath);
        fs.unlinkSync(mp4Path);

        res.send("✅ Upload success");

    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Failed");
    }
});

// =====================
// 🌐 ROOT ROUTE (fallback)
// =====================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================
// 🚀 START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
