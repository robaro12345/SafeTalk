import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Generate JWT access token
 */
export const generateAccessToken = (payload) => {
  try {
    const options = {
      expiresIn: config.jwt.expire,
      algorithm: config.jwt.privateKey ? 'RS256' : 'HS256',
      issuer: config.app.name,
      audience: config.app.frontendUrl
    };

    const secret = config.jwt.privateKey || config.jwt.secret;
    return jwt.sign(payload, secret, options);
  } catch (error) {
    throw new Error('Failed to generate access token');
  }
};

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  try {
    const options = {
      expiresIn: config.jwt.refreshExpire,
      algorithm: config.jwt.privateKey ? 'RS256' : 'HS256',
      issuer: config.app.name,
      audience: config.app.frontendUrl
    };

    const secret = config.jwt.privateKey || config.jwt.refreshSecret;
    return jwt.sign(payload, secret, options);
  } catch (error) {
    throw new Error('Failed to generate refresh token');
  }
};

/**
 * Verify JWT token
 */
export const verifyToken = (token, isRefreshToken = false) => {
  try {
    const options = {
      algorithms: [config.jwt.privateKey ? 'RS256' : 'HS256'],
      issuer: config.app.name,
      audience: config.app.frontendUrl
    };

    const secret = config.jwt.publicKey || (isRefreshToken ? config.jwt.refreshSecret : config.jwt.secret);
    return jwt.verify(token, secret, options);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generate token pair (access + refresh)
 */
export const generateTokenPair = (payload) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  
  return { accessToken, refreshToken };
};