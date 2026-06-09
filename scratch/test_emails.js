const fs = require('fs');
const path = require('path');

// Mock nodemailer before importing mailer.js
const nodemailer = require('nodemailer');
const mockTransporter = {
    sendMail: async (options) => {
        console.log(`Mocking sendMail for: ${options.subject}`);
        const filename = options.subject.replace(/[^a-zA-Z0-9]/g, '_') + '.html';
        const outputPath = path.join(__dirname, filename);
        fs.writeFileSync(outputPath, options.html, 'utf8');
        console.log(`Saved output to: ${outputPath}`);
        return { messageId: 'mock-id-12345' };
    }
};

// Override nodemailer.createTransport
nodemailer.createTransport = () => mockTransporter;

// Set env variable to avoid empty check bypass
process.env.SMTP_USER = 'test@example.com';

const { notifyAdmin, sendAutoReply } = require('../mailer');

async function run() {
    try {
        console.log("Generating admin notification...");
        await notifyAdmin(
            "Jan Novák",
            "jan.novak@example.com",
            "TIKTOK_VIDEA",
            "5 000 - 10 000 CZK",
            "Ahoj Samueli,\n\nchtěl bych se s tebou domluvit na natočení a sestříhání několika videí na náš firemní TikTok. Máme už nějakou představu, ale rádi si necháme poradit.\n\nDíky!",
            "@jannovak_creative"
        );

        console.log("Generating client auto-reply...");
        await sendAutoReply(
            "jan.novak@example.com",
            "Jan Novák"
        );

        console.log("Done generating templates.");
    } catch (err) {
        console.error("Error during generation:", err);
    }
}

run();
