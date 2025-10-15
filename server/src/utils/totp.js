import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import config from '../config/index.js';

/**
 * Generate TOTP secret for user
 */
export const generateTOTPSecret = (userEmail) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `${config.app.name} (${userEmail})`,
      issuer: config.app.name,
      length: 32
    });
    
    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url
    };
  } catch (error) {
    throw new Error('Failed to generate TOTP secret');
  }
};

/**
 * Generate QR Code for TOTP setup
 */
export const generateQRCode = async (otpauthUrl) => {
  try {
    const qrCodeDataURL = await qrcode.toDataURL(otpauthUrl);
    return qrCodeDataURL;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Verify TOTP token
 */
export const verifyTOTP = (secret, token) => {
  try {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 steps before and after current time
    });
  } catch (error) {
    throw new Error('Failed to verify TOTP');
  }
};

/**
 * Generate backup codes for TOTP
 */
export const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};