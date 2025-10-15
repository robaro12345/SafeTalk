import nodemailer from 'nodemailer';
import config from '../config/index.js';

// Create reusable transporter object using SMTP
const createTransporter = () => {
  try {
    return nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    throw new Error('Email service configuration error');
  }
};

/**
 * Send OTP email
 */
export const sendOTPEmail = async (email, otp, username) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: config.app.name,
        address: config.email.user
      },
      to: email,
      subject: `${config.app.name} - Login Verification Code`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Verification - ${config.app.name}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-code { background: #fff; border: 2px dashed #10B981; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #10B981; letter-spacing: 5px; font-family: monospace; }
            .warning { background: #FEF3CD; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 ${config.app.name}</h1>
              <p>Secure Login Verification</p>
            </div>
            <div class="content">
              <h2>Hello, ${username}!</h2>
              <p>You're attempting to sign in to your ${config.app.name} account. Please use the verification code below:</p>
              
              <div class="otp-code">
                <div class="code">${otp}</div>
                <p><strong>This code expires in 3 minutes</strong></p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul>
                  <li>Never share this code with anyone</li>
                  <li>If you didn't request this code, please ignore this email</li>
                  <li>For security, this code can only be used once</li>
                </ul>
              </div>
              
              <p>If you're having trouble, please contact our support team.</p>
              
              <div class="footer">
                <p>© 2024 ${config.app.name} - Secure End-to-End Encrypted Messaging</p>
                <p>This is an automated message, please do not reply.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        ${config.app.name} - Login Verification
        
        Hello ${username},
        
        Your verification code is: ${otp}
        
        This code expires in 3 minutes.
        
        Never share this code with anyone.
        If you didn't request this code, please ignore this email.
        
        © 2024 ${config.app.name}
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Failed to send OTP email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: config.app.name,
        address: config.email.user
      },
      to: email,
      subject: `Welcome to ${config.app.name} - Your Account is Ready!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${config.app.name}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .feature { background: #fff; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #10B981; }
            .cta { text-align: center; margin: 30px 0; }
            .button { background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to ${config.app.name}!</h1>
              <p>Your secure messaging account is ready</p>
            </div>
            <div class="content">
              <h2>Hello, ${username}!</h2>
              <p>Thank you for joining ${config.app.name}. Your account has been successfully created with end-to-end encryption enabled.</p>
              
              <h3>🔐 Your Security Features:</h3>
              <div class="feature">
                <strong>End-to-End Encryption:</strong> All your messages are encrypted and only you and your recipient can read them.
              </div>
              <div class="feature">
                <strong>Two-Factor Authentication:</strong> Your account is protected with 2FA for enhanced security.
              </div>
              <div class="feature">
                <strong>Secure Key Management:</strong> Your encryption keys are securely stored and never shared.
              </div>
              
              <div class="cta">
                <a href="${config.app.frontendUrl}" class="button">Start Messaging Securely</a>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Log in with your credentials and complete 2FA verification</li>
                <li>Start conversations with friends and family</li>
                <li>Enjoy secure, private messaging</li>
              </ul>
              
              <div class="footer">
                <p>© 2024 ${config.app.name} - Secure End-to-End Encrypted Messaging</p>
                <p>Questions? Contact our support team anytime.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    // Don't throw error for welcome email failure
    return null;
  }
};