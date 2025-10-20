import express from 'express';
import User from '../models/User.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { searchLimiter, passwordLimiter } from '../middleware/rateLimiter.js';
import { validateInput, asyncHandler } from '../middleware/validation.js';
import { 
  searchUsersSchema, 
  changePasswordSchema, 
  update2FASchema 
} from '../utils/validation.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { generateTOTPSecret, generateQRCode } from '../utils/totp.js';

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
          twoFAMethod: user.twoFAMethod,
          publicKey: user.publicKey,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
  })
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { username, email } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate username
    if (username) {
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({
          success: false,
          message: 'Username must be between 3 and 30 characters'
        });
      }
      
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
      
      user.username = username;
    }

    // Validate email
    if (email) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email'
        });
      }
      
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }
      
      user.email = email;
      user.isEmailVerified = false; // Reset verification if email changes
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
          twoFAMethod: user.twoFAMethod,
          publicKey: user.publicKey,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
  })
);

/**
 * @route   GET /api/users/search
 * @desc    Search for users by username or email
 * @access  Private
 */
router.get('/search',
  authenticateToken,
  searchLimiter,
  validateInput(searchUsersSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { query } = req.query;
    const currentUserId = req.user.userId;

    // Search users by username or email (case insensitive)
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // Exclude current user
        { isActive: true }, // Only active users
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .select('username email publicKey')
    .limit(20);

    res.status(200).json({
      success: true,
      data: { users }
    });
  })
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID (public info only)
 * @access  Private
 */
router.get('/:userId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    console.debug('[users.route] GET /api/users/:userId called with userId=', userId);

    const user = await User.findById(userId)
      .select('username email publicKey createdAt isActive');
    console.debug('[users.route] DB lookup result for', userId, '=>', !!user, user ? { id: user._id, isActive: user.isActive } : null);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  })
);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password',
  authenticateToken,
  passwordLimiter,
  validateInput(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(user.passwordHash, currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);
    user.passwordHash = newPasswordHash;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

/**
 * @route   PUT /api/users/update-2fa
 * @desc    Update 2FA method
 * @access  Private
 */
router.put('/update-2fa',
  authenticateToken,
  validateInput(update2FASchema),
  asyncHandler(async (req, res) => {
    const { twoFAMethod, currentPassword } = req.body;
    const userId = req.user.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password for security
    const isPasswordValid = await verifyPassword(user.passwordHash, currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    let totpSetup = null;

    // Handle TOTP setup
    if (twoFAMethod === 'totp' && user.twoFAMethod !== 'totp') {
      const { secret, otpauthUrl } = generateTOTPSecret(user.email);
      user.totpSecret = secret;
      
      const qrCodeDataURL = await generateQRCode(otpauthUrl);
      totpSetup = {
        secret,
        qrCode: qrCodeDataURL,
        manualEntryKey: secret
      };
    } else if (twoFAMethod === 'email' && user.twoFAMethod === 'totp') {
      // Remove TOTP secret when switching to email
      user.totpSecret = undefined;
    }

    user.twoFAMethod = twoFAMethod;
    await user.save();

    const response = {
      success: true,
      message: '2FA method updated successfully',
      twoFAMethod: user.twoFAMethod
    };

    if (totpSetup) {
      response.totpSetup = totpSetup;
    }

    res.status(200).json(response);
  })
);

/**
 * @route   GET /api/users/admin/all
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get('/admin/all',
  authenticateToken,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const searchQuery = search ? {
      $or: [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const users = await User.find(searchQuery)
      .select('-passwordHash -totpSecret')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUsers,
          pages: Math.ceil(totalUsers / parseInt(limit))
        }
      }
    });
  })
);

/**
 * @route   PUT /api/users/admin/:userId/status
 * @desc    Update user status (Admin only)
 * @access  Private (Admin)
 */
router.put('/admin/:userId/status',
  authenticateToken,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (userId === req.user.userId && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { 
        userId: user._id,
        isActive: user.isActive 
      }
    });
  })
);

export default router;

/**
 * Admin-only: Temporarily store decrypted private key for debugging
 */
/**
 * Admin-only: Retrieve temporary decrypted private key
 */
/**
 * Return decrypted private key for authenticated user after verifying password
 */
