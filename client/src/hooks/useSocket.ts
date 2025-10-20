import { useEffect, useRef, useCallback } from 'react';
import socketService from '../utils/socket';
import { useAuth } from '../context/AuthContext';

interface MessageData {
  recipientId: string;
  content: string;
  messageType?: string;
}

export const useSocket = () => {
  const { isAuthenticated } = useAuth();
  const listenersRef = useRef<Map<string, Array<(...args: any[]) => void>>>(new Map());

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
  const on = useCallback((eventName: string, callback: (...args: any[]) => void) => {
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
  const off = useCallback((eventName: string, callback: (...args: any[]) => void) => {
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
  const emit = useCallback((eventName: string, data?: any) => {
    socketService.emit(eventName, data);
  }, []);

  const joinConversation = useCallback((otherUserId: string) => {
    socketService.joinConversation(otherUserId);
  }, []);

  const leaveConversation = useCallback((otherUserId: string) => {
    socketService.leaveConversation(otherUserId);
  }, []);

  const sendMessage = useCallback((messageData: MessageData) => {
    socketService.sendMessage(messageData);
  }, []);

  const markMessageAsRead = useCallback((messageId: string, senderId: string) => {
    socketService.markMessageAsRead(messageId, senderId);
  }, []);

  const startTyping = useCallback((receiverId: string) => {
    socketService.startTyping(receiverId);
  }, []);

  const stopTyping = useCallback((receiverId: string) => {
    socketService.stopTyping(receiverId);
  }, []);

  const getUserStatus = useCallback((userIds: string[]) => {
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
    onNewMessage: (callback: (...args: any[]) => void) => on('new_message', callback),
    onMessageSent: (callback: (...args: any[]) => void) => on('message_sent', callback),
    onMessageError: (callback: (...args: any[]) => void) => on('message_error', callback),
    onMessageReadReceipt: (callback: (...args: any[]) => void) => on('message_read_receipt', callback),
    onUserTyping: (callback: (...args: any[]) => void) => on('user_typing', callback),
    onUserOnline: (callback: (...args: any[]) => void) => on('user_online', callback),
    onUserOffline: (callback: (...args: any[]) => void) => on('user_offline', callback),
    onUserStatusList: (callback: (...args: any[]) => void) => on('user_status_list', callback),
    onConversationJoined: (callback: (...args: any[]) => void) => on('conversation_joined', callback),
    onConversationMessage: (callback: (...args: any[]) => void) => on('conversation_message', callback),
  };
};