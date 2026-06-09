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
    if (!process.env.SMTP_USER) {
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
        subject: `Nová zakázka | KARBYVISUAL: ${contactName} - ${projectType}`,
        html: `
            <!DOCTYPE html>
            <html lang="cs">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta name="color-scheme" content="light dark">
                <meta name="supported-color-schemes" content="light dark">
                <style>
                    :root {
                        color-scheme: light dark;
                        supported-color-schemes: light dark;
                    }
                    /* Force dark styles regardless of user's system preferences */
                    @media (prefers-color-scheme: dark), (prefers-color-scheme: light) {
                        body, .email-bg {
                            background-color: #000000 !important;
                            color: #ffffff !important;
                        }
                        .email-card {
                            background-color: #080808 !important;
                            border-color: #1a1a1a !important;
                        }
                        .email-title {
                            color: #ffffff !important;
                        }
                        .email-text {
                            color: #dddddd !important;
                        }
                        .email-divider {
                            border-color: #151515 !important;
                        }
                        .email-label {
                            color: #888888 !important;
                        }
                        .email-box {
                            background-color: #111111 !important;
                            border-color: #1a1a1a !important;
                        }
                        .email-msg-box {
                            background-color: #0b0b0b !important;
                            border-color: #151515 !important;
                        }
                        .email-bold {
                            color: #ffffff !important;
                        }
                        .email-footer {
                            color: #444444 !important;
                        }
                        .email-detail-row {
                            border-bottom-color: #151515 !important;
                        }
                        .email-status-val {
                            color: #ffffff !important;
                        }
                    }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #000000;">
                <div class="email-bg" style="background-color: #000000; margin: 0; padding: 40px 0; font-family: 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif; width: 100%; text-align: left;">
                    <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #080808; border: 1px solid #1a1a1a; padding: 40px; color: #ffffff; box-sizing: border-box;">
                        
                        <!-- Header with System Alert style -->
                        <div class="email-divider" style="text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid #151515;">
                            <h1 class="email-title" style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; line-height: 1.2;">
                                NOVÁ ZAKÁZKA
                            </h1>
                            <div style="font-family: 'Courier New', Courier, monospace; font-size: 9px; color: #888888; margin-top: 8px; letter-spacing: 3px; font-weight: bold; text-transform: uppercase;">
                                // INCOMING COMMISSION REQUEST
                            </div>
                        </div>
                        
                        <!-- System Details Box -->
                        <div style="margin-bottom: 30px;">
                            <div class="email-detail-row" style="margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #151515; padding-bottom: 8px;">
                                <span class="email-label" style="font-family: 'Courier New', Courier, monospace; color: #888888; display: inline-block; width: 140px;">CLIENT_NAME:</span>
                                <strong class="email-bold" style="color: #ffffff;">${contactName}</strong>
                            </div>
                            <div class="email-detail-row" style="margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #151515; padding-bottom: 8px;">
                                <span class="email-label" style="font-family: 'Courier New', Courier, monospace; color: #888888; display: inline-block; width: 140px;">CLIENT_EMAIL:</span>
                                <a class="email-bold" href="mailto:${contactEmail}" style="color: #ffffff; text-decoration: underline; font-weight: bold;">${contactEmail}</a>
                            </div>
                            <div class="email-detail-row" style="margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #151515; padding-bottom: 8px;">
                                <span class="email-label" style="font-family: 'Courier New', Courier, monospace; color: #888888; display: inline-block; width: 140px;">INSTAGRAM:</span>
                                ${instagram ? `<a class="email-bold" href="https://instagram.com/${instagram.replace('@', '')}" style="color: #ffffff; text-decoration: underline; font-weight: bold;">@${instagram.replace('@', '')}</a>` : '<span class="email-label" style="color: #888888;">NOT_PROVIDED</span>'}
                            </div>
                            <div class="email-detail-row" style="margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #151515; padding-bottom: 8px;">
                                <span class="email-label" style="font-family: 'Courier New', Courier, monospace; color: #888888; display: inline-block; width: 140px;">PROJECT_TYPE:</span>
                                <span class="email-box" style="color: #ffffff; background-color: #111111; padding: 2px 8px; border: 1px solid #1a1a1a; font-size: 12px; font-weight: bold; text-transform: uppercase;">${projectType}</span>
                            </div>
                            <div class="email-detail-row" style="margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #151515; padding-bottom: 8px;">
                                <span class="email-label" style="font-family: 'Courier New', Courier, monospace; color: #888888; display: inline-block; width: 140px;">BUDGET_RANGE:</span>
                                <span class="email-box" style="color: #ffffff; background-color: #111111; padding: 2px 8px; border: 1px solid #1a1a1a; font-size: 12px; font-weight: bold;">${budget}</span>
                            </div>
                        </div>
                        
                        <!-- Message Box -->
                        <div style="margin-top: 30px; margin-bottom: 30px;">
                            <div class="email-label" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #888888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                                // USER_MESSAGE_BODY
                            </div>
                            <div class="email-msg-box email-text" style="background-color: #0b0b0b; border: 1px solid #151515; border-left: 3px solid #888888; padding: 20px; font-size: 14px; line-height: 1.6; color: #dddddd; white-space: pre-wrap;">${message}</div>
                        </div>
                        
                        <!-- Status / Action footer -->
                        <div class="email-box" style="background-color: #111111; padding: 15px; border-radius: 4px; border: 1px dashed #333333; text-align: center; margin-top: 40px;">
                            <span class="email-label" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #888888;">SYSTEM_STATUS:</span>
                            <strong class="email-status-val" style="color: #ffffff; font-family: 'Courier New', Courier, monospace; font-size: 12px; letter-spacing: 1px; margin-left: 5px;">AWAITING_REPLY_FROM_SAMUEL</strong>
                        </div>

                        <!-- Footer -->
                        <hr class="email-divider" style="border: none; border-top: 1px solid #151515; margin: 30px 0;" />
                        <div class="email-footer" style="font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #444444; text-align: center; letter-spacing: 1px; text-transform: uppercase;">
                            DIRECTED BY FAJLAJP // KARBYVISUALS Team
                        </div>
                        
                    </div>
                </div>
            </body>
            </html>
        `
    };

    return transporter.sendMail(mailOptions);
}

// Sends Auto-Reply to User
async function sendAutoReply(contactEmail, contactName) {
    if (!process.env.SMTP_USER) {
        console.warn("SMTP_USER empty, skipping auto-reply.");
        return;
    }

    const mailOptions = {
        from: `"KARBYVISUAL" <${process.env.SMTP_USER}>`,
        to: contactEmail,
        subject: `Díky za zájem o spolupráci! // KARBYVISUALS`,
        html: `
            <!DOCTYPE html>
            <html lang="cs">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta name="color-scheme" content="light dark">
                <meta name="supported-color-schemes" content="light dark">
                <style>
                    :root {
                        color-scheme: light dark;
                        supported-color-schemes: light dark;
                    }
                    /* Force dark styles regardless of user's system preferences */
                    @media (prefers-color-scheme: dark), (prefers-color-scheme: light) {
                        body, .email-bg {
                            background-color: #000000 !important;
                            color: #ffffff !important;
                        }
                        .email-card {
                            background-color: #080808 !important;
                            border-color: #1a1a1a !important;
                        }
                        .email-title {
                            color: #ffffff !important;
                        }
                        .email-text {
                            color: #dddddd !important;
                        }
                        .email-divider {
                            border-color: #151515 !important;
                        }
                        .email-bold {
                            color: #ffffff !important;
                        }
                        .email-footer {
                            color: #444444 !important;
                        }
                        .email-logo-sub {
                            color: #888888 !important;
                        }
                    }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #000000;">
                <div class="email-bg" style="background-color: #000000; margin: 0; padding: 40px 0; font-family: 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif; width: 100%; text-align: left;">
                    <div class="email-card" style="max-width: 600px; margin: 0 auto; background-color: #080808; border: 1px solid #1a1a1a; padding: 40px; color: #ffffff; box-sizing: border-box;">
                        
                        <!-- Header with Logo matching Hero -->
                        <div class="email-divider" style="text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid #151515;">
                            <h1 class="email-title" style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -1px; text-transform: uppercase; margin: 0; line-height: 1.0;">
                                KARBYVISUALS
                            </h1>
                            <div class="email-logo-sub" style="font-family: 'Courier New', Courier, monospace; font-size: 9px; color: #888888; margin-top: 8px; letter-spacing: 3px; font-weight: bold; text-transform: uppercase;">
                                Cinematographer & Photographer
                            </div>
                        </div>
                        
                        <!-- Body Text -->
                        <p class="email-text" style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-bottom: 20px;">
                            Zdravím ${contactName},
                        </p>
                        
                        <p class="email-text" style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-bottom: 20px;">
                            děkuji za poptávku! Pro začátek prosím nahraj své podklady (moodboardy, loga, nápady či videa) na <strong class="email-bold" style="color: #ffffff;">Google Drive</strong> a pošli mi odkaz.
                        </p>
                        
                        <p class="email-text" style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-bottom: 20px;">
                            <strong class="email-bold" style="color: #ffffff;">SAMUEL</strong> se ti ozve co nejdříve a domluvíte se na detailech.
                        </p>
                        
                        <p class="email-text" style="font-size: 15px; line-height: 1.6; color: #dddddd; margin-top: 30px; margin-bottom: 0;">
                            Měj se fajn,<br>
                            <strong class="email-bold" style="color: #ffffff;">Samuel Karban</strong>
                        </p>
                        
                        <!-- Footer -->
                        <hr class="email-divider" style="border: none; border-top: 1px solid #151515; margin: 30px 0;" />
                        <div class="email-footer" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #444444; text-align: center; letter-spacing: 1px; text-transform: uppercase;">
                            DIRECTED BY FAJLAJP // KARBYVISUALS Team
                        </div>
                        
                    </div>
                </div>
            </body>
            </html>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { notifyAdmin, sendAutoReply };
