import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { verifyToken } from './utils/jwt.js';
import User from './models/User.js';
import Message from './models/Message.js';
import config from './config/index.js';

// Store active user connections
const activeUsers = new Map();

/**
 * Socket.io authentication middleware
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    
    // Check if user exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(new Error('User not found or inactive'));
    }

    // Add user info to socket
    socket.userId = user._id.toString();
    socket.userEmail = user.email;
    socket.username = user.username;
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Invalid authentication token'));
  }
};

/**
 * Initialize Socket.io server
 */
const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });

  // Apply authentication middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.username} (${socket.userId})`);

    // Add user to active users
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      username: socket.username,
      email: socket.userEmail,
      lastSeen: new Date()
    });

    // Broadcast user online status to their contacts
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      username: socket.username
    });

    // Join user to their personal room for direct messaging
    socket.join(`user_${socket.userId}`);

    // Handle joining conversation rooms
    socket.on('join_conversation', ({ otherUserId }) => {
      try {
        if (!otherUserId) {
          socket.emit('error', { message: 'Other user ID is required' });
          return;
        }

        // Create a consistent room name for the conversation
        const roomName = [socket.userId, otherUserId].sort().join('_');
        socket.join(roomName);
        
        console.log(`📩 ${socket.username} joined conversation with ${otherUserId}`);
        
        socket.emit('conversation_joined', { 
          roomName, 
          otherUserId 
        });
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Handle leaving conversation rooms
    socket.on('leave_conversation', ({ otherUserId }) => {
      try {
        const roomName = [socket.userId, otherUserId].sort().join('_');
        socket.leave(roomName);
        
        console.log(`📤 ${socket.username} left conversation with ${otherUserId}`);
      } catch (error) {
        console.error('Leave conversation error:', error);
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { 
          receiverId,
          content,
          senderEncryptedContent,
          messageType = 'text',
          tempId // Client-generated temporary ID for optimistic updates
        } = data;

        if (!receiverId || !content) {
          socket.emit('message_error', { 
            tempId,
            message: 'Missing required message data' 
          });
          return;
        }

        // Verify receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver || !receiver.isActive) {
          socket.emit('message_error', { 
            tempId,
            message: 'Recipient not found' 
          });
          return;
        }

        // Create message in database with both encrypted versions
        const message = new Message({
          sender: socket.userId,
          receiver: receiverId,
          content, // Encrypted for receiver
          senderEncryptedContent, // Encrypted for sender
          messageType
        });

        await message.save();

        // Populate sender info for the response
        await message.populate('sender', 'username email');

        // Send confirmation to sender with their encrypted version
        const senderMessageData = {
          id: message._id,
          sender: {
            id: message.sender._id,
            username: message.sender.username,
            email: message.sender.email
          },
          receiver: {
            id: receiverId
          },
          content: message.senderEncryptedContent || message.content, // Use sender's encrypted version
          messageType: message.messageType,
          timestamp: message.createdAt,
          status: 'sent',
          tempId
        };

        // Send confirmation to sender
        socket.emit('message_sent', senderMessageData);

        // Send message to receiver if they're online with their encrypted version
        const receiverConnection = activeUsers.get(receiverId);
        if (receiverConnection) {
          const receiverMessageData = {
            id: message._id,
            sender: {
              id: message.sender._id,
              username: message.sender.username,
              email: message.sender.email
            },
            receiver: {
              id: receiverId
            },
            content: message.content, // Use receiver's encrypted version
            messageType: message.messageType,
            timestamp: message.createdAt,
            status: 'delivered',
            tempId
          };
          
          io.to(`user_${receiverId}`).emit('new_message', receiverMessageData);

          // Update message status to delivered
          message.status = 'delivered';
          await message.save();
        }

        // Broadcast to conversation room
        const roomName = [socket.userId, receiverId].sort().join('_');
        socket.to(roomName).emit('conversation_message', senderMessageData);

        console.log(`💬 Message sent from ${socket.username} to ${receiverId}`);

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('message_error', { 
          tempId: data.tempId,
          message: 'Failed to send message' 
        });
      }
    });

    // Handle message status updates (read receipts)
    socket.on('message_read', async (data) => {
      try {
        const { messageId, senderId } = data;

        if (!messageId) {
          return;
        }

        // Update message status to read
        const message = await Message.findOneAndUpdate(
          { 
            _id: messageId, 
            receiver: socket.userId,
            status: { $in: ['sent', 'delivered'] }
          },
          { status: 'read' },
          { new: true }
        );

        if (message && senderId) {
          // Notify sender about read receipt
          io.to(`user_${senderId}`).emit('message_read_receipt', {
            messageId: message._id,
            readBy: socket.userId,
            readAt: new Date()
          });
        }

      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Handle typing indicators
    socket.on('typing_start', ({ receiverId }) => {
      try {
        if (!receiverId) return;

        const roomName = [socket.userId, receiverId].sort().join('_');
        socket.to(roomName).emit('user_typing', {
          userId: socket.userId,
          username: socket.username,
          isTyping: true
        });
      } catch (error) {
        console.error('Typing start error:', error);
      }
    });

    socket.on('typing_stop', ({ receiverId }) => {
      try {
        if (!receiverId) return;

        const roomName = [socket.userId, receiverId].sort().join('_');
        socket.to(roomName).emit('user_typing', {
          userId: socket.userId,
          username: socket.username,
          isTyping: false
        });
      } catch (error) {
        console.error('Typing stop error:', error);
      }
    });

    // Handle user status requests
    socket.on('get_user_status', ({ userIds }) => {
      try {
        const statusList = userIds.map(userId => ({
          userId,
          isOnline: activeUsers.has(userId),
          lastSeen: activeUsers.get(userId)?.lastSeen || null
        }));

        socket.emit('user_status_list', statusList);
      } catch (error) {
        console.error('Get user status error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${socket.username} (${reason})`);

      // Remove user from active users
      activeUsers.delete(socket.userId);

      // Broadcast user offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        username: socket.username,
        lastSeen: new Date()
      });

      // Update user's last seen timestamp
      User.findByIdAndUpdate(socket.userId, { 
        lastLogin: new Date() 
      }).catch(console.error);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.username}:`, error);
    });
  });

  return io;
};

export { initializeSocket, activeUsers };