const express = require('express');
const multer = require('multer');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 1. CONFIGURATION (Make sure these match your Render Environment Variables)
const token = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const bot = new TelegramBot(token, { polling: false });

// 2. AUTO-CREATE UPLOADS FOLDER (Crucial for Render)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("✅ Created 'uploads' directory");
}

// 3. STORAGE SETUP
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, uploadDir); },
    filename: (req, file, cb) => { cb(null, file.originalname); }
});

// Increased limit to 50MB to handle high-quality video segments
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } 
});

app.use(express.static('.'));
app.use(express.json());

// 4. THE UPLOAD ROUTE
app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
        console.error("❌ No file received");
        return res.status(400).send("No file uploaded");
    }

    console.log(`📩 Received: ${req.file.filename}`);

    try {
        // Send to Telegram
        await bot.sendVideo(chatId, req.file.path, {
            caption: `🎥 New Segment: ${req.file.filename}`
        });
        
        console.log(`🚀 Sent to Bot: ${req.file.filename}`);
        
        // Delete file after sending to keep the Render disk clean
        fs.unlinkSync(req.file.path);
        
        res.status(200).send("Success");
    } catch (error) {
        console.error("❌ Telegram Error:", error.message);
        res.status(500).send("Bot failed to send video");
    }
});

app.listen(port, () => {
    console.log(`🌐 Server running on port ${port}`);
});
