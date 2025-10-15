import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  // Initialize socket connection
  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const serverUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    this.socket = io(serverUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    this.setupEventListeners();
    return this.socket;
  }

  // Setup basic socket event listeners
  setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to SafeTalk server');
      this.isConnected = true;
      toast.success('Connected to server');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected the client, try to reconnect
        toast.error('Connection lost. Trying to reconnect...');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      toast.error('Failed to connect to server');
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected to server (attempt ${attemptNumber})`);
      toast.success('Reconnected to server');
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error);
    });

    // Authentication error
    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      if (error.message?.includes('Authentication')) {
        toast.error('Authentication failed. Please login again.');
        // Redirect to login or refresh token
      }
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // Check if socket is connected
  isSocketConnected() {
    return this.socket?.connected || false;
  }

  // Join conversation room
  joinConversation(otherUserId) {
    if (this.socket) {
      this.socket.emit('join_conversation', { otherUserId });
    }
  }

  // Leave conversation room
  leaveConversation(otherUserId) {
    if (this.socket) {
      this.socket.emit('leave_conversation', { otherUserId });
    }
  }

  // Send message
  sendMessage(messageData) {
    if (this.socket) {
      this.socket.emit('send_message', messageData);
    }
  }

  // Mark message as read
  markMessageAsRead(messageId, senderId) {
    if (this.socket) {
      this.socket.emit('message_read', { messageId, senderId });
    }
  }

  // Typing indicators
  startTyping(receiverId) {
    if (this.socket) {
      this.socket.emit('typing_start', { receiverId });
    }
  }

  stopTyping(receiverId) {
    if (this.socket) {
      this.socket.emit('typing_stop', { receiverId });
    }
  }

  // Get user status
  getUserStatus(userIds) {
    if (this.socket) {
      this.socket.emit('get_user_status', { userIds });
    }
  }

  // Event listener management
  on(eventName, callback) {
    if (this.socket) {
      this.socket.on(eventName, callback);
      
      // Store listener for cleanup
      if (!this.listeners.has(eventName)) {
        this.listeners.set(eventName, []);
      }
      this.listeners.get(eventName).push(callback);
    }
  }

  off(eventName, callback) {
    if (this.socket) {
      this.socket.off(eventName, callback);
      
      // Remove from stored listeners
      const eventListeners = this.listeners.get(eventName);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    }
  }

  // Remove all listeners for an event
  removeAllListeners(eventName) {
    if (this.socket) {
      this.socket.removeAllListeners(eventName);
      this.listeners.delete(eventName);
    }
  }

  // Emit custom event
  emit(eventName, data) {
    if (this.socket) {
      this.socket.emit(eventName, data);
    }
  }

  // Message event handlers (convenience methods)
  onNewMessage(callback) {
    this.on('new_message', callback);
  }

  onMessageSent(callback) {
    this.on('message_sent', callback);
  }

  onMessageError(callback) {
    this.on('message_error', callback);
  }

  onMessageReadReceipt(callback) {
    this.on('message_read_receipt', callback);
  }

  onUserTyping(callback) {
    this.on('user_typing', callback);
  }

  onUserOnline(callback) {
    this.on('user_online', callback);
  }

  onUserOffline(callback) {
    this.on('user_offline', callback);
  }

  onUserStatusList(callback) {
    this.on('user_status_list', callback);
  }

  onConversationJoined(callback) {
    this.on('conversation_joined', callback);
  }

  onConversationMessage(callback) {
    this.on('conversation_message', callback);
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;