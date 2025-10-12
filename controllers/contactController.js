import nodemailer from 'nodemailer';

// Email configuration using Gmail
const createTransporter = () => {
    const emailUser = process.env.EMAIL_USER || 'yzentechnologies@gmail.com';
    const emailPass = process.env.EMAIL_PASS;

    if (!emailPass) {
        console.error('⚠️ WARNING: EMAIL_PASS not set in .env file!');
        console.error('Contact form emails will not work without Gmail App Password');
    }

    return nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
};

// Handle contact form submission
export const submitContactForm = async (req, res) => {
    try {
        const { name, email, mobile, subject, message } = req.body;

        // Validation
        if (!name || !email || !mobile || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if email credentials are configured
        if (!process.env.EMAIL_PASS) {
            console.error('❌ EMAIL_PASS not configured in .env file');
            return res.status(500).json({
                success: false,
                message: 'Email service not configured. Please contact administrator.'
            });
        }

        const transporter = createTransporter();

        // Email to admin
        const adminMailOptions = {
            from: process.env.EMAIL_USER || 'yzentechnologies@gmail.com',
            to: 'yzentechnologies@gmail.com',
            subject: `ArtAdventureHub Contact: ${subject}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .info-box { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; border-radius: 5px; }
                        .label { font-weight: bold; color: #667eea; }
                        .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0;">🎨 New Contact Form Submission</h1>
                            <p style="margin: 10px 0 0 0;">ArtAdventureHub</p>
                        </div>
                        <div class="content">
                            <div class="info-box">
                                <p><span class="label">Name:</span> ${name}</p>
                            </div>
                            <div class="info-box">
                                <p><span class="label">Email:</span> <a href="mailto:${email}">${email}</a></p>
                            </div>
                            <div class="info-box">
                                <p><span class="label">Mobile:</span> ${mobile}</p>
                            </div>
                            <div class="info-box">
                                <p><span class="label">Subject:</span> ${subject}</p>
                            </div>
                            <div class="info-box">
                                <p><span class="label">Message:</span></p>
                                <p style="margin-top: 10px; white-space: pre-wrap;">${message}</p>
                            </div>
                            <div class="footer">
                                <p>This email was sent from ArtAdventureHub contact form</p>
                                <p>Received on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        // Auto-reply to user
        const userMailOptions = {
            from: process.env.EMAIL_USER || 'yzentechnologies@gmail.com',
            to: email,
            subject: 'Thank you for contacting ArtAdventureHub!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0;">🎨 Thank You!</h1>
                            <p style="margin: 10px 0 0 0;">ArtAdventureHub</p>
                        </div>
                        <div class="content">
                            <p>Dear ${name},</p>
                            <p>Thank you for contacting ArtAdventureHub! We have received your message and will get back to you within 24 hours.</p>
                            
                            <p><strong>Your Message Details:</strong></p>
                            <p><strong>Subject:</strong> ${subject}</p>
                            <p><strong>Message:</strong><br>${message}</p>
                            
                            <p style="margin-top: 30px;">In the meantime, feel free to explore our active art contests!</p>
                            
                            <center>
                                <a href="https://artadventurehub.com" class="button">Visit ArtAdventureHub</a>
                            </center>
                            
                            <p style="margin-top: 30px; color: #666; font-size: 14px;">
                                Best regards,<br>
                                <strong>ArtAdventureHub Team</strong><br>
                                YoungZen Technologies
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        // Send both emails
        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(userMailOptions);

        res.json({
            success: true,
            message: 'Message sent successfully! We will get back to you soon.'
        });

    } catch (error) {
        console.error('Contact Form Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message. Please try again later.',
            error: error.message
        });
    }
};

