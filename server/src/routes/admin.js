import express from 'express';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/validation.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

/**
 * @route   GET /api/admin/stats
 * @desc    Get system statistics
 * @access  Private/Admin
 */
router.get('/stats', asyncHandler(async (req, res) => {
  // Get date ranges
  const now = new Date();
  const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Parallel queries for better performance
  const [
    totalUsers,
    activeUsers,
    totalMessages,
    usersLast24h,
    usersLast7d,
    usersLast30d,
    messagesLast24h,
    messagesLast7d,
    messagesLast30d,
    lockedAccounts,
    bannedUsers,
    emailUsers,
    totpUsers
  ] = await Promise.all([
    // User stats
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    
    // Message stats
    Message.countDocuments({ isDeleted: false }),
    
    // Users by time period
    User.countDocuments({ createdAt: { $gte: last24Hours } }),
    User.countDocuments({ createdAt: { $gte: last7Days } }),
    User.countDocuments({ createdAt: { $gte: last30Days } }),
    
    // Messages by time period
    Message.countDocuments({ createdAt: { $gte: last24Hours }, isDeleted: false }),
    Message.countDocuments({ createdAt: { $gte: last7Days }, isDeleted: false }),
    Message.countDocuments({ createdAt: { $gte: last30Days }, isDeleted: false }),
    
    // Account status
    User.countDocuments({ lockUntil: { $gt: now } }),
    User.countDocuments({ isActive: false }),
    
    // 2FA methods
    User.countDocuments({ twoFAMethod: 'email' }),
    User.countDocuments({ twoFAMethod: 'totp' })
  ]);

  // Get top message senders
  const topSenders = await Message.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$sender', messageCount: { $sum: 1 } } },
    { $sort: { messageCount: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        username: '$user.username',
        email: '$user.email',
        messageCount: 1
      }
    }
  ]);

  // Get recent logins
  const recentLogins = await User.find({ lastLogin: { $exists: true, $ne: null } })
    .sort({ lastLogin: -1 })
    .limit(10)
    .select('username email lastLogin role')
    .lean();

  res.json({
    success: true,
    stats: {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        locked: lockedAccounts,
        new24h: usersLast24h,
        new7d: usersLast7d,
        new30d: usersLast30d,
        byTwoFAMethod: {
          email: emailUsers,
          totp: totpUsers
        }
      },
      messages: {
        total: totalMessages,
        last24h: messagesLast24h,
        last7d: messagesLast7d,
        last30d: messagesLast30d
      },
      topSenders,
      recentLogins
    }
  });
}));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination and filters
 * @access  Private/Admin
 */
router.get('/users', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    role = '',
    isActive = '',
    twoFAMethod = '',
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (role) query.role = role;
  if (isActive !== '') query.isActive = isActive === 'true';
  if (twoFAMethod) query.twoFAMethod = twoFAMethod;

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  // Execute queries
  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash -totpSecret')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(query)
  ]);

  // Check for locked accounts
  const now = Date.now();
  const usersWithStatus = users.map(user => ({
    ...user,
    isLocked: !!(user.lockUntil && user.lockUntil > now)
  }));

  res.json({
    success: true,
    users: usersWithStatus,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get detailed user information
 * @access  Private/Admin
 */
router.get('/users/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select('-passwordHash -totpSecret')
    .lean();

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Get message statistics for this user
  const [sentMessages, receivedMessages, recentMessages] = await Promise.all([
    Message.countDocuments({ sender: userId, isDeleted: false }),
    Message.countDocuments({ receiver: userId, isDeleted: false }),
    Message.find({ 
      $or: [{ sender: userId }, { receiver: userId }],
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('sender', 'username email')
      .populate('receiver', 'username email')
      .lean()
  ]);

  const now = Date.now();
  const userDetail = {
    ...user,
    isLocked: !!(user.lockUntil && user.lockUntil > now),
    messageStats: {
      sent: sentMessages,
      received: receivedMessages,
      total: sentMessages + receivedMessages
    },
    recentMessages
  };

  res.json({
    success: true,
    user: userDetail
  });
}));

/**
 * @route   PUT /api/admin/users/:userId/ban
 * @desc    Ban/Unban a user
 * @access  Private/Admin
 */
router.put('/users/:userId/ban', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { ban, reason } = req.body;

  // Prevent banning yourself
  if (userId === req.user.userId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot ban yourself'
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Prevent banning other admins
  if (user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Cannot ban another admin'
    });
  }

  user.isActive = !ban;
  await user.save();

  // Log the action (you can create a separate AuditLog model for this)
  console.log(`[ADMIN ACTION] ${req.user.email} ${ban ? 'banned' : 'unbanned'} user ${user.email}. Reason: ${reason || 'None provided'}`);

  res.json({
    success: true,
    message: `User ${ban ? 'banned' : 'unbanned'} successfully`,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      isActive: user.isActive
    }
  });
}));

/**
 * @route   PUT /api/admin/users/:userId/unlock
 * @desc    Unlock a locked user account
 * @access  Private/Admin
 */
router.put('/users/:userId/unlock', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  await user.resetLoginAttempts();

  console.log(`[ADMIN ACTION] ${req.user.email} unlocked user ${user.email}`);

  res.json({
    success: true,
    message: 'User account unlocked successfully',
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      loginAttempts: 0,
      lockUntil: null
    }
  });
}));

/**
 * @route   PUT /api/admin/users/:userId/role
 * @desc    Change user role
 * @access  Private/Admin
 */
router.put('/users/:userId/role', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be "user" or "admin"'
    });
  }

  // Prevent changing your own role
  if (userId === req.user.userId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot change your own role'
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  user.role = role;
  await user.save();

  console.log(`[ADMIN ACTION] ${req.user.email} changed ${user.email}'s role to ${role}`);

  res.json({
    success: true,
    message: `User role updated to ${role}`,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
}));

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Permanently delete a user account
 * @access  Private/Admin
 */
router.delete('/users/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { confirm } = req.body;

  if (!confirm) {
    return res.status(400).json({
      success: false,
      message: 'Deletion must be confirmed'
    });
  }

  // Prevent deleting yourself
  if (userId === req.user.userId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot delete yourself'
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Prevent deleting other admins
  if (user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Cannot delete another admin'
    });
  }

  // Delete all messages from this user
  await Message.deleteMany({ 
    $or: [{ sender: userId }, { receiver: userId }] 
  });

  // Delete the user
  await User.findByIdAndDelete(userId);

  console.log(`[ADMIN ACTION] ${req.user.email} deleted user ${user.email}`);

  res.json({
    success: true,
    message: 'User and all associated data deleted successfully'
  });
}));

/**
 * @route   GET /api/admin/activity
 * @desc    Get recent system activity
 * @access  Private/Admin
 */
router.get('/activity', asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;

  // Get recent messages
  const recentMessages = await Message.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('sender', 'username email')
    .populate('receiver', 'username email')
    .select('sender receiver messageType status createdAt')
    .lean();

  // Get recent user registrations
  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .select('username email role createdAt')
    .lean();

  res.json({
    success: true,
    activity: {
      recentMessages,
      recentUsers
    }
  });
}));

/**
 * @route   GET /api/admin/analytics
 * @desc    Get detailed analytics data
 * @access  Private/Admin
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  const { period = '30' } = req.query; // days
  
  const days = parseInt(period);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // User growth over time
  const userGrowth = await User.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Message activity over time
  const messageActivity = await Message.aggregate([
    { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    analytics: {
      period: `${days} days`,
      userGrowth,
      messageActivity
    }
  });
}));

export default router;
