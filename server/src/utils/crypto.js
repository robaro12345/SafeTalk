import crypto from 'crypto';
import argon2 from 'argon2';

/**
 * Generate RSA key pair for end-to-end encryption
 */
export const generateRSAKeyPair = () => {
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    return { publicKey, privateKey };
  } catch (error) {
    throw new Error('Failed to generate RSA key pair');
  }
};

/**
 * Encrypt private key with password-derived key using AES-256-GCM
 */
// Private key encryption/decryption removed. This module now contains
// general-purpose crypto helpers used by the server (RSA generation,
// password/OTP hashing, secure random generation).

/**
 * Hash password using Argon2
 */
export const hashPassword = async (password) => {
  try {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  } catch (error) {
    throw new Error('Failed to hash password');
  }
};

/**
 * Verify password against hash
 */
export const verifyPassword = async (hash, password) => {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    throw new Error('Failed to verify password');
  }
};

/**
 * Generate secure random OTP
 */
export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hash OTP for secure storage
 */
export const hashOTP = async (otp) => {
  return await argon2.hash(otp);
};

/**
 * Verify OTP against hash
 */
export const verifyOTP = async (hash, otp) => {
  return await argon2.verify(hash, otp);
};

/**
 * Generate secure random string
 */
export const generateSecureRandom = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};