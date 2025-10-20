import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import ChatList from '../components/ChatList';
import MessageBubble from '../components/MessageBubble';
import InputBox from '../components/InputBox';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { messageAPI, userAPI } from '../utils/api';
import cryptoUtils from '../utils/crypto';
import toast from 'react-hot-toast';

const ChatRoom = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const socket = useSocket();
  
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // No encryption keys used anymore
    const getEncryptionKeys = () => {
      try {
        const jwk = localStorage.getItem('privateKeyJwk');
        return jwk ? JSON.parse(jwk) : null;
      } catch (e) {
        return null;
      }
    };

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle chat selection
  const handleChatSelect = async (chatUser) => {
    setMessages([]);

    // chatUser might be a conversation object with 'otherUser' or a plain user
    try {
      let candidate = chatUser;
      if (chatUser?.otherUser) candidate = chatUser.otherUser;

      // Resolve possible id fields and coerce to string to avoid ObjectId objects leaking into the URL
      const rawId = candidate?.id || candidate?._id || candidate?.userId;
      const userId = rawId ? String(rawId) : null;

      if (!userId) {
        toast.error('Invalid user selected');
        return;
      }

  // Fetch full user profile (includes publicKey)
  const resp = await userAPI.getUserById(userId, { silent: true });
  const fullUser = resp.data.data.user;

  // Normalize fullUser to always include `id` as a string to keep UI comparisons stable
  const normalizedId = fullUser.id || fullUser._id ? String(fullUser.id || fullUser._id) : userId;
  const normalizedUser = { ...fullUser, id: normalizedId };

  // Debug: log raw/normalized ids when problems occur
  console.debug('Selected chat user raw id:', rawId, 'normalized:', normalizedId);

  setSelectedChat(normalizedUser);

  // Join conversation room
  socket.joinConversation(normalizedId);

  // Load conversation history
  await loadMessages(normalizedId);
    } catch (error) {
      console.error('Failed to load selected chat user profile:', error);
      const message = error.response?.data?.message;
      if (message && message.toLowerCase().includes('not found')) {
        toast.error('User not found');
      } else {
        toast.error('Failed to load user profile');
      }
    }
  };

  // Load messages for a conversation
  const loadMessages = async (userId) => {
    try {
      setIsLoadingMessages(true);
      const response = await messageAPI.getConversation(userId);
      const conversationMessages = response.data.data.messages;
      // Messages stored on server are ciphertext (RSA-OAEP base64). Attempt to decrypt each message.
      const privateKeyJwk = getEncryptionKeys();

      const plainMessages = await Promise.all(conversationMessages.map(async (m) => {
        let decrypted = null;
        let decryptionError = false;
        
        // Normalize sender id for isOwn checks
        const sender = m.sender || {};
        const senderId = sender.id || sender._id || (sender._id && String(sender._id)) || null;
        const receiver = m.receiver || {};
        const receiverId = receiver.id || receiver._id || (receiver._id && String(receiver._id)) || null;
        
        // Try to decrypt message with our private key
        // The server now returns the appropriate encrypted version based on who's requesting
        if (privateKeyJwk) {
          try {
            decrypted = await cryptoUtils.decryptWithPrivateKeyJwk(privateKeyJwk, m.content);
          } catch (e) {
            console.error('Decryption failed for message:', m.id || m._id, e);
            decryptionError = true;
            decrypted = null;
          }
        }

        return {
          ...m,
          id: m.id || m._id,
          sender: { ...sender, id: senderId },
          receiver: { ...receiver, id: receiverId },
          decryptedContent: decrypted || m.content || m.text || null,
          decryptionError
        };
      }));

      setMessages(plainMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load conversation');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Decrypt message content
  // No decryption required; messages come as plain content
  const decryptMessageContent = async (message) => {
    const privateKeyJwk = getEncryptionKeys();
    if (!privateKeyJwk) return message.content || message.text || null;

    try {
      const decrypted = await cryptoUtils.decryptWithPrivateKeyJwk(privateKeyJwk, message.content);
      return decrypted;
    } catch (e) {
      return message.content || message.text || null;
    }
  };

  // Send message
  const handleSendMessage = async (messageText) => {
    if (!selectedChat || !messageText.trim()) return;

    try {
      // Fetch recipient publicKey (must exist) and encrypt before sending.
      const receiverId = selectedChat.id || selectedChat._id;

      let recipientPublicKeyPem = selectedChat.publicKey || null;
      if (!recipientPublicKeyPem) {
        try {
          // silent: true prevents api layer from showing its own toast
          const resp = await userAPI.getUserById(receiverId, { silent: true });
          recipientPublicKeyPem = resp.data.data.user.publicKey;
        } catch (e) {
          console.error('Failed to fetch recipient publicKey:', e);
          const status = e.response?.status;
          if (status === 404) {
            toast.error('User not found');
          } else {
            toast.error('Failed to fetch recipient public key — cannot send encrypted message');
          }
          return;
        }
      }

      if (!recipientPublicKeyPem) {
        toast.error('Recipient does not have a public key — cannot send encrypted message');
        return;
      }

      // Get sender's own public key to encrypt for themselves
      let senderPublicKeyPem = user.publicKey || null;
      if (!senderPublicKeyPem) {
        try {
          const resp = await userAPI.getUserById(user.id, { silent: true });
          senderPublicKeyPem = resp.data.data.user.publicKey;
        } catch (e) {
          console.error('Failed to fetch own publicKey:', e);
        }
      }

      // Encrypt for receiver
      let receiverCiphertext;
      try {
        receiverCiphertext = await cryptoUtils.encryptWithPublicKeyPem(recipientPublicKeyPem, messageText);
      } catch (e) {
        console.error('Encryption for receiver failed:', e);
        toast.error('Message encryption failed — message not sent');
        return;
      }

      // Encrypt for sender (so they can decrypt their own messages)
      let senderCiphertext;
      if (senderPublicKeyPem) {
        try {
          senderCiphertext = await cryptoUtils.encryptWithPublicKeyPem(senderPublicKeyPem, messageText);
        } catch (e) {
          console.error('Encryption for sender failed:', e);
          // Continue anyway, sender can still see plaintext in current session
        }
      }

      const messageData = {
        receiverId,
        content: receiverCiphertext,
        senderEncryptedContent: senderCiphertext,
        messageType: 'text',
        tempId: Date.now().toString() // For optimistic updates
      };
      
      // Add optimistic message to UI
      const optimisticMessage = {
        id: messageData.tempId,
        sender: { id: user.id, username: user.username },
        receiver: { id: selectedChat.id || selectedChat._id },
        decryptedContent: messageText,
        content: senderCiphertext || receiverCiphertext, // Use sender's encrypted version for display
        timestamp: new Date().toISOString(),
        status: 'sending',
        tempId: messageData.tempId
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      
  // Debug: log messageData before sending
  console.log('Sending messageData to backend:', messageData);
  // Send via socket for real-time delivery
  socket.sendMessage(messageData);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  // Handle typing indicators
  const handleTyping = (isTyping) => {
    if (selectedChat) {
      if (isTyping) {
        socket.startTyping(selectedChat.id);
      } else {
        socket.stopTyping(selectedChat.id);
      }
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket.isConnected) return;

    // Handle new messages
    const handleNewMessage = async (messageData) => {
      try {
          const decryptedContent = await decryptMessageContent(messageData);
          const newMessage = {
            ...messageData,
            decryptedContent,
            content: decryptedContent,
            decryptionError: false
          };
        
        setMessages(prev => {
          // Remove any existing message with the same tempId
          const filtered = prev.filter(msg => msg.tempId !== messageData.tempId);
          return [...filtered, newMessage];
        });
        
        // Show notification for new message from sender
        if (messageData.sender && messageData.sender.username) {
          // Only show toast if the message is from someone else (not our own message)
          if (messageData.sender.id !== user.id) {
            toast.success(`New message from ${messageData.sender.username}`, {
              duration: 3000,
              icon: '💬',
            });
          }
        }
        
        // Mark as read if chat is currently selected
        if (selectedChat && messageData.sender.id === selectedChat.id) {
          socket.markMessageAsRead(messageData.id, messageData.sender.id);
        }
      } catch (error) {
        console.error('Failed to decrypt received message:', error);
      }
    };

    // Handle message sent confirmation
    const handleMessageSent = async (messageData) => {
      // Try to decrypt the confirmed message with our private key
      const decryptedContent = await decryptMessageContent(messageData);
      
      setMessages(prev => 
        prev.map(msg => {
          if (msg.tempId === messageData.tempId) {
            return {
              ...msg, 
              id: messageData.id, 
              status: 'sent',
              content: messageData.content,
              decryptedContent: decryptedContent || msg.decryptedContent,
              decryptionError: !decryptedContent
            };
          }
          return msg;
        })
      );
    };

    // Handle message errors
    const handleMessageError = (errorData) => {
      toast.error(errorData.message || 'Failed to send message');
      setMessages(prev => 
        prev.map(msg => 
          msg.tempId === errorData.tempId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
    };

    // Handle typing indicators
    const handleUserTyping = (data) => {
      if (selectedChat && data.userId === selectedChat.id) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.username);
          } else {
            newSet.delete(data.username);
          }
          return newSet;
        });
        
        // Clear typing indicator after delay
        if (data.isTyping) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.username);
              return newSet;
            });
          }, 3000);
        }
      }
    };

    // Handle read receipts
    const handleMessageReadReceipt = (data) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, status: 'read' }
            : msg
        )
      );
    };

    // Register socket event listeners
    socket.onNewMessage(handleNewMessage);
    socket.onMessageSent(handleMessageSent);
    socket.onMessageError(handleMessageError);
    socket.onUserTyping(handleUserTyping);
    socket.onMessageReadReceipt(handleMessageReadReceipt);

    return () => {
      // Cleanup is handled by the socket hook
    };
  }, [socket.isConnected, selectedChat]);

  return (
    <div className="h-screen bg-gray-100 flex">
      {/* Chat List Sidebar */}
      <ChatList 
        onSelectChat={handleChatSelect}
        selectedChatId={selectedChat?.id}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <span className="font-semibold text-green-600">
                    {selectedChat.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedChat.username}</h2>
                  <p className="text-sm text-gray-500">
                    {typingUsers.size > 0 ? (
                      <span className="text-green-600">
                        {Array.from(typingUsers).join(', ')} typing...
                      </span>
                    ) : (
                      'Online'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Encryption Notice */}
              <div className="flex justify-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 flex items-center space-x-2 text-sm text-yellow-800">
                  <Shield className="w-4 h-4" />
                  <span>Messages are end-to-end encrypted</span>
                </div>
              </div>

              {/* Message Loading */}
              {isLoadingMessages && (
                <div className="flex justify-center">
                  <div className="text-gray-500">Loading messages...</div>
                </div>
              )}

              {/* Messages */}
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id || message.tempId || index}
                  message={message}
                  isOwn={message.sender.id === user.id}
                />
              ))}

              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 rounded-2xl rounded-bl-sm px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Box */}
            <InputBox 
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
            />
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to SafeTalk
              </h2>
              <p className="text-gray-600 mb-6 max-w-md">
                Select a conversation from the sidebar to start messaging securely with end-to-end encryption.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>End-to-end encrypted</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Two-factor authentication</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Zero-knowledge architecture</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;