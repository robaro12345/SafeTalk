import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import { validateInput, asyncHandler } from '../middleware/validation.js';
import { sendMessageSchema } from '../utils/validation.js';

const router = express.Router();

/**
 * @route   POST /api/messages/send
 * @desc    Send a message
 * @access  Private
 */
router.post('/send',
  authenticateToken,
  messageLimiter,
  validateInput(sendMessageSchema),
  asyncHandler(async (req, res) => {
      const { receiverId, content, messageType = 'text' } = req.body;
    const senderId = req.user.userId;

    // Validate sender and receiver are different
    if (senderId.toString() === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself'
      });
    }

    // Verify receiver exists and is active
    const receiver = await User.findById(receiverId);
    if (!receiver || !receiver.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Create message (plaintext)
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      messageType
    });

    await message.save();

    // Populate sender and receiver info for response
    await message.populate([
      { path: 'sender', select: 'username email' },
      { path: 'receiver', select: 'username email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: message._id,
        sender: message.sender,
        receiver: message.receiver,
        content: message.content,
        messageType: message.messageType,
        status: message.status,
        timestamp: message.createdAt
      }
    });
  })
);

/**
 * @route   GET /api/messages/conversation/:userId
 * @desc    Get conversation between current user and specified user
 * @access  Private
 */
router.get('/conversation/:userId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;

    // Validate other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ],
      isDeleted: false
    })
    .populate([
      { path: 'sender', select: 'username email' },
      { path: 'receiver', select: 'username email' }
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Mark messages as read (only messages sent to current user)
    await Message.updateMany(
      {
        sender: userId,
        receiver: currentUserId,
        status: { $in: ['sent', 'delivered'] }
      },
      { status: 'read' }
    );

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit)
        },
        conversation: {
          otherUser: {
            id: otherUser._id,
            username: otherUser.username,
            email: otherUser.email
          }
        }
      }
    });
  })
);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get list of all conversations for current user
 * @access  Private
 */
router.get('/conversations',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const currentUserId = req.user.userId;

    // Get all conversations with latest message
    const conversations = await Message.aggregate([
      // Match messages involving current user
      {
        $match: {
          $or: [
            { sender: currentUserId },
            { receiver: currentUserId }
          ],
          isDeleted: false
        }
      },
      // Sort by creation date
      { $sort: { createdAt: -1 } },
      // Group by conversation (sender-receiver pair)
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', currentUserId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', currentUserId] },
                    { $in: ['$status', ['sent', 'delivered']] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      // Lookup user information
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'otherUser'
        }
      },
      // Unwind user array
      { $unwind: '$otherUser' },
      // Project final structure
      {
        $project: {
          otherUser: {
            id: '$otherUser._id',
            username: '$otherUser.username',
            email: '$otherUser.email'
          },
          lastMessage: {
            id: '$lastMessage._id',
            content: '$lastMessage.content',
            messageType: '$lastMessage.messageType',
            timestamp: '$lastMessage.createdAt',
            status: '$lastMessage.status',
            isFromMe: { $eq: ['$lastMessage.sender', currentUserId] }
          },
          unreadCount: 1
        }
      },
      // Sort by last message timestamp
      { $sort: { 'lastMessage.timestamp': -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: { conversations }
    });
  })
);

/**
 * @route   PUT /api/messages/:messageId/status
 * @desc    Update message status (delivered/read)
 * @access  Private
 */
router.put('/:messageId/status',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { status } = req.body;
    const currentUserId = req.user.userId;

    // Validate status
    if (!['delivered', 'read'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "delivered" or "read"'
      });
    }

    // Find message and verify user is receiver
    const message = await Message.findOne({
      _id: messageId,
      receiver: currentUserId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Update status only if it's progressing (sent -> delivered -> read)
    const statusOrder = ['sent', 'delivered', 'read'];
    const currentStatusIndex = statusOrder.indexOf(message.status);
    const newStatusIndex = statusOrder.indexOf(status);

    if (newStatusIndex > currentStatusIndex) {
      message.status = status;
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: 'Message status updated',
      data: { status: message.status }
    });
  })
);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete a message (soft delete)
 * @access  Private
 */
router.delete('/:messageId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const currentUserId = req.user.userId;

    // Find message and verify user is sender
    const message = await Message.findOne({
      _id: messageId,
      sender: currentUserId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or you are not authorized to delete this message'
      });
    }

    // Soft delete
    message.isDeleted = true;
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  })
);

export default router;