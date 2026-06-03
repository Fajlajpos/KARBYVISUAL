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
async function notifyAdmin(contactName, contactEmail, projectType, budget, message, instagram) {
    if(!process.env.SMTP_USER) {
        console.warn("SMTP_USER empty, skipping admin notification email.");
        return;
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'karbyvisuals@gmail.com';
    const contactReceiver = process.env.CONTACT_RECEIVER;
    
    const recipients = [adminEmail];
    if (contactReceiver && contactReceiver !== adminEmail) {
        recipients.push(contactReceiver);
    }

    const mailOptions = {
        from: `"KARBYVISUAL Web" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: `Nová Poptávka | KARBYVISUAL: ${contactName} - ${projectType}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #111; color: #fff;">
                <h2 style="color: #e60000;">Nová Poptávka z Webu</h2>
                <hr style="border: 1px solid #333;" />
                <p><strong>Jméno:</strong> ${contactName}</p>
                <p><strong>E-mail:</strong> ${contactEmail}</p>
                <p><strong>Instagram:</strong> ${instagram || '---'}</p>
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
        subject: `Díky za poptávku! // KARBYVISUALS`,
        html: `
            <div style="background-color: #000000; margin: 0; padding: 40px 0; font-family: 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif; width: 100%; text-align: left;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #080808; border: 1px solid #1a1a1a; padding: 40px; color: #ffffff; box-sizing: border-box;">
                    
                    <!-- Header with Logo matching Hero -->
                    <div style="text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid #151515;">
                        <h1 style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -1px; text-transform: uppercase; margin: 0; line-height: 1.0;">
                            KARBYVISUALS
                        </h1>
                        <div style="font-family: 'Courier New', Courier, monospace; font-size: 9px; color: #e60000; margin-top: 8px; letter-spacing: 3px; font-weight: bold; text-transform: uppercase;">
                            Cinematographer & Photographer
                        </div>
                    </div>
                    
                    <!-- Body Text -->
                    <p style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-bottom: 20px;">
                        Zdravím ${contactName},
                    </p>
                    
                    <p style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-bottom: 20px;">
                        Díky za odeslání poptávky. Tvoje specifikace projektu úspěšně dorazily do mého systému a už teď na ně koukám. Každému projektu věnuji maximální péči, takže si detaily pečlivě projdu. Ozvu se ti zpět co nejdříve, standardně během 24 až 48 hodin, abychom probrali další postup a možnosti spolupráce.
                    </p>
                    
                    <p style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-bottom: 20px;">
                        Pokud už teď máš připravené nějaké podklady, nápady, moodboardy nebo rovnou natočené záběry, můžeš mi je poslat přímo na tyto kontakty:
                    </p>
                    
                    <!-- Contact Box -->
                    <div style="background: #111111; padding: 20px; border-left: 3px solid #e60000; margin: 25px 0; font-size: 14px; line-height: 1.6;">
                        <strong style="color: #ffffff;">E-mail:</strong> <a href="mailto:samkarban@gmail.com" style="color: #e60000; text-decoration: none; font-weight: bold;">samkarban@gmail.com</a><br>
                        <strong style="color: #ffffff;">Instagram:</strong> <a href="https://www.instagram.com/karbyvisuals/" style="color: #e60000; text-decoration: none; font-weight: bold;">@karbyvisuals</a><br>
                        <strong style="color: #ffffff;">Telefon:</strong> <span style="color: #ffffff;">+420 737 516 301</span>
                    </div>
                    
                    <p style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-bottom: 20px;">
                        V případě velkých souborů (videa, audio nebo balíky fotek) je prosím nahraj na <strong>WeTransfer</strong>, <strong>MyAirBridge</strong> nebo nasdílej složku na <strong>Google Drive</strong> a pošli mi odkaz.
                    </p>
                    
                    <p style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-top: 35px; margin-bottom: 0;">
                        Těším se na spolupráci. Měj se fajn,<br>
                        <strong style="color: #ffffff;">Samuel Karban</strong>
                    </p>
                    
                    <!-- Footer -->
                    <hr style="border: none; border-top: 1px solid #151515; margin: 30px 0;" />
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #444444; text-align: center; letter-spacing: 1px; text-transform: uppercase;">
                        DIRECTED BY FAJLAJP // KARBYVISUALS Team
                    </div>
                    
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { notifyAdmin, sendAutoReply };
