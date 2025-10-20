import express from 'express';
import User from '../models/User.js';
import EmailOTP from '../models/EmailOTP.js';
import { 
  hashPassword,
  verifyPassword,
  generateOTP,
  hashOTP,
  verifyOTP
} from '../utils/crypto.js';
import { generateTokenPair } from '../utils/jwt.js';
import { sendOTPEmail, sendWelcomeEmail } from '../utils/email.js';
import { generateTOTPSecret, generateQRCode, verifyTOTP } from '../utils/totp.js';
import { 
  registerSchema, 
  loginSchema, 
  verify2FASchema 
} from '../utils/validation.js';
import { validateInput, asyncHandler } from '../middleware/validation.js';
import { authLimiter, registerLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with 2FA setup
 * @access  Public
 */
router.post('/register', 
  registerLimiter,
  validateInput(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, username, password, twoFAMethod } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      } else {
        return res.status(409).json({
          success: false,
          message: 'Username already taken'
        });
      }
    }

    // Use client-provided publicKey if available
    const publicKey = req.body.publicKey || undefined;

    // Hash password
  const passwordHash = await hashPassword(password);
    
    // Prepare user data (private key is not stored server-side)
    if (!publicKey) {
      return res.status(400).json({ success: false, message: 'publicKey is required in registration payload' });
    }

    const userData = {
      email,
      username,
      passwordHash,
      publicKey,
      twoFAMethod
    };

    // Handle TOTP setup if selected
    let totpSetup = null;
    if (twoFAMethod === 'totp') {
      const { secret, otpauthUrl } = generateTOTPSecret(email);
      userData.totpSecret = secret;
      
      const qrCodeDataURL = await generateQRCode(otpauthUrl);
      totpSetup = {
        secret,
        qrCode: qrCodeDataURL,
        manualEntryKey: secret
      };
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, username).catch(console.error);

    // Prepare response
    const response = {
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        twoFAMethod: user.twoFAMethod
      }
    };

    // Include TOTP setup data if applicable
    if (totpSetup) {
      response.totpSetup = totpSetup;
    }

    res.status(201).json(response);
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and initiate 2FA
 * @access  Public
 */
router.post('/login',
  authLimiter,
  validateInput(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to multiple failed login attempts'
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(user.passwordHash, password);
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Password is correct, reset login attempts
    await user.resetLoginAttempts();

    // Handle 2FA based on user's preferred method
    if (user.twoFAMethod === 'email') {
      // Generate and send OTP
      const otp = generateOTP();
      const otpHash = await hashOTP(otp);
      
      // Save OTP to database
      await EmailOTP.findOneAndDelete({ userId: user._id }); // Remove any existing OTP
      const emailOTP = new EmailOTP({
        userId: user._id,
        otpHash
      });
      await emailOTP.save();

      // Send OTP via email
      await sendOTPEmail(user.email, otp, user.username);

      return res.status(200).json({
        success: true,
        message: 'OTP sent to your email',
        requiresTwoFA: true,
        twoFAMethod: 'email',
        userId: user._id
      });
    } else if (user.twoFAMethod === 'totp') {
      return res.status(200).json({
        success: true,
        message: 'Please enter your authenticator code',
        requiresTwoFA: true,
        twoFAMethod: 'totp',
        userId: user._id
      });
    }
  })
);

/**
 * @route   POST /api/auth/verify-2fa
 * @desc    Verify 2FA and complete login
 * @access  Public
 */
router.post('/verify-2fa',
  authLimiter,
  validateInput(verify2FASchema),
  asyncHandler(async (req, res) => {
    const { userId, code } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid request'
      });
    }

    let isCodeValid = false;

    // Verify based on 2FA method
    if (user.twoFAMethod === 'email') {
      // Verify email OTP
      const emailOTP = await EmailOTP.findOne({ userId: user._id });
      if (!emailOTP || emailOTP.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'OTP expired or not found'
        });
      }

      if (emailOTP.attempts >= 3) {
        await EmailOTP.findByIdAndDelete(emailOTP._id);
        return res.status(429).json({
          success: false,
          message: 'Too many attempts. Please request a new OTP'
        });
      }

      isCodeValid = await verifyOTP(emailOTP.otpHash, code);
      
      if (!isCodeValid) {
        // Increment attempts
        emailOTP.attempts += 1;
        await emailOTP.save();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid OTP',
          attemptsRemaining: 3 - emailOTP.attempts
        });
      }

      // OTP is valid, delete it
      await EmailOTP.findByIdAndDelete(emailOTP._id);

    } else if (user.twoFAMethod === 'totp') {
      // Verify TOTP
      isCodeValid = verifyTOTP(user.totpSecret, code);
      
      if (!isCodeValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authenticator code'
        });
      }
    }

    // 2FA verification successful
    if (isCodeValid) {
      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT tokens
      const tokenPayload = {
        userId: user._id,
        email: user.email,
        role: user.role
      };
      
      const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
          publicKey: user.publicKey
        },
        accessToken
      });
    }
  })
);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP for email-based 2FA
 * @access  Public
 */
router.post('/resend-otp',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user || !user.isActive || user.twoFAMethod !== 'email') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Replace existing OTP
    await EmailOTP.findOneAndDelete({ userId: user._id });
    const emailOTP = new EmailOTP({
      userId: user._id,
      otpHash
    });
    await emailOTP.save();

    // Send OTP via email
    await sendOTPEmail(user.email, otp, user.username);

    res.status(200).json({
      success: true,
      message: 'New OTP sent to your email'
    });
  })
);

/**
 * @route   POST /api/auth/regenerate-totp
 * @desc    Regenerate TOTP setup for user (when they can't access their authenticator)
 * @access  Public (but requires email and password verification)
 */
router.post('/regenerate-totp',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(user.passwordHash, password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is using TOTP
    if (user.twoFAMethod !== 'totp') {
      return res.status(400).json({
        success: false,
        message: 'User is not using authenticator app 2FA'
      });
    }

    // Generate new TOTP secret
    const { secret, otpauthUrl } = generateTOTPSecret(user.email);
    user.totpSecret = secret;
    await user.save();
    
    const qrCodeDataURL = await generateQRCode(otpauthUrl);
    const totpSetup = {
      secret,
      qrCode: qrCodeDataURL,
      manualEntryKey: secret
    };

    res.status(200).json({
      success: true,
      message: 'TOTP setup regenerated successfully',
      totpSetup: totpSetup,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        twoFAMethod: user.twoFAMethod
      }
    });
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and clear refresh token
 * @access  Private
 */
router.post('/logout', (req, res) => {
  // Clear refresh token cookie
  res.clearCookie('refreshToken');
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;