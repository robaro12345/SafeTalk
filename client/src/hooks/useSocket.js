import { useEffect, useRef, useCallback } from 'react';
import socketService from '../utils/socket';
import { useAuth } from '../context/AuthContext';

export const useSocket = () => {
  const { isAuthenticated } = useAuth();
  const listenersRef = useRef(new Map());

  // Initialize socket connection when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        socketService.connect(token);
      }
    } else {
      socketService.disconnect();
    }

    // Cleanup on unmount
    return () => {
      // Remove all listeners added by this hook
      listenersRef.current.forEach((callbacks, eventName) => {
        callbacks.forEach(callback => {
          socketService.off(eventName, callback);
        });
      });
      listenersRef.current.clear();
    };
  }, [isAuthenticated]);

  // Add event listener with automatic cleanup
  const on = useCallback((eventName, callback) => {
    socketService.on(eventName, callback);

    // Track listener for cleanup
    if (!listenersRef.current.has(eventName)) {
      listenersRef.current.set(eventName, []);
    }
    listenersRef.current.get(eventName).push(callback);

    // Return cleanup function
    return () => {
      socketService.off(eventName, callback);
      const callbacks = listenersRef.current.get(eventName);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }, []);

  // Remove event listener
  const off = useCallback((eventName, callback) => {
    socketService.off(eventName, callback);
    const callbacks = listenersRef.current.get(eventName);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }, []);

  // Socket methods
  const emit = useCallback((eventName, data) => {
    socketService.emit(eventName, data);
  }, []);

  const joinConversation = useCallback((otherUserId) => {
    socketService.joinConversation(otherUserId);
  }, []);

  const leaveConversation = useCallback((otherUserId) => {
    socketService.leaveConversation(otherUserId);
  }, []);

  const sendMessage = useCallback((messageData) => {
    socketService.sendMessage(messageData);
  }, []);

  const markMessageAsRead = useCallback((messageId, senderId) => {
    socketService.markMessageAsRead(messageId, senderId);
  }, []);

  const startTyping = useCallback((receiverId) => {
    socketService.startTyping(receiverId);
  }, []);

  const stopTyping = useCallback((receiverId) => {
    socketService.stopTyping(receiverId);
  }, []);

  const getUserStatus = useCallback((userIds) => {
    socketService.getUserStatus(userIds);
  }, []);

  const isConnected = socketService.isSocketConnected();

  return {
    // Connection status
    isConnected,

    // Event management
    on,
    off,
    emit,

    // Message methods
    joinConversation,
    leaveConversation,
    sendMessage,
    markMessageAsRead,

    // Typing indicators
    startTyping,
    stopTyping,

    // User status
    getUserStatus,

    // Convenience event handlers
    onNewMessage: (callback) => on('new_message', callback),
    onMessageSent: (callback) => on('message_sent', callback),
    onMessageError: (callback) => on('message_error', callback),
    onMessageReadReceipt: (callback) => on('message_read_receipt', callback),
    onUserTyping: (callback) => on('user_typing', callback),
    onUserOnline: (callback) => on('user_online', callback),
    onUserOffline: (callback) => on('user_offline', callback),
    onUserStatusList: (callback) => on('user_status_list', callback),
    onConversationJoined: (callback) => on('conversation_joined', callback),
    onConversationMessage: (callback) => on('conversation_message', callback),
  };
};