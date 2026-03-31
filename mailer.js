const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Sends notification to Admin
async function notifyAdmin(contactName, contactEmail, projectType, budget, message) {
    if(!process.env.SMTP_USER) {
        console.warn("SMTP_USER empty, skipping admin notification email.");
        return;
    }

    const mailOptions = {
        from: `"KARBYVISUAL Web" <${process.env.SMTP_USER}>`,
        to: process.env.CONTACT_RECEIVER || process.env.ADMIN_EMAIL,
        subject: `Nová Poptávka | KARBYVISUAL: ${contactName} - ${projectType}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #111; color: #fff;">
                <h2 style="color: #e60000;">Nová Poptávka z Webu</h2>
                <hr style="border: 1px solid #333;" />
                <p><strong>Jméno:</strong> ${contactName}</p>
                <p><strong>E-mail:</strong> ${contactEmail}</p>
                <p><strong>Typ Projektu:</strong> ${projectType}</p>
                <p><strong>Rozpočet:</strong> ${budget}</p>
                <p><strong>Zpráva:</strong></p>
                <div style="background: #222; padding: 15px; border-left: 3px solid #e60000; margin-top: 10px;">
                    ${message}
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

// Sends Auto-Reply to User
async function sendAutoReply(contactEmail, contactName) {
    if(!process.env.SMTP_USER) {
        console.warn("SMTP_USER empty, skipping auto-reply.");
        return;
    }

    const mailOptions = {
        from: `"KARBYVISUAL" <${process.env.SMTP_USER}>`,
        to: contactEmail,
        subject: `Your Inquiry Receipt | KARBYVISUAL`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 30px; background: #000; color: #fff; text-align: center;">
                <h1 style="letter-spacing: 5px; text-transform: uppercase;">Karby<span style="color: #666;">Visual</span></h1>
                <p style="text-align: left; margin-top: 30px; font-size: 16px; line-height: 1.5;">
                    Dear ${contactName},<br><br>
                    Thank you for reaching out. We have received your inquiry and will review it shortly.
                    Due to high volume, it may take 24-48 hours for us to respond.<br><br>
                    Best Regards,<br>
                    <strong>KARBYVISUAL Team</strong>
                </p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { notifyAdmin, sendAutoReply };
