import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, User, Settings, LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { messageAPI, userAPI } from '../utils/api';
import toast from 'react-hot-toast';

interface ChatUser {
  id: string;
  username: string;
  email: string;
}

interface Conversation {
  otherUser: ChatUser;
  lastMessage: {
    content?: string;
    decryptedContent?: string;
    timestamp: string;
    isFromMe: boolean;
    status?: string;
  };
  unreadCount: number;
}

interface ChatListProps {
  onSelectChat: (user: ChatUser) => void;
  selectedChatId: string | null;
  onNewChat?: () => void;
}

const ChatList: React.FC<ChatListProps> = ({ onSelectChat, selectedChatId, onNewChat }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, []);

  // Search users when search term changes
  useEffect(() => {
    if (searchTerm.length > 2) {
      searchUsers();
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchTerm]);

  // Listen for new messages and user status via socket
  useEffect(() => {
    if (!socket.isConnected) return;

    // Handle new messages - update conversation list
    const handleNewMessage = (messageData) => {
      // Reload conversations to get updated list with new message
      loadConversations();
      
      // Show notification if not in the selected chat
      if (messageData.sender && messageData.sender.id !== user.id) {
        const isCurrentChat = selectedChatId === messageData.sender.id;
        if (!isCurrentChat) {
          toast.success(`New message from ${messageData.sender.username}`, {
            duration: 3000,
            icon: '💬',
          });
        }
      }
    };

    // Handle message sent - update our own conversation list
    const handleMessageSent = (messageData) => {
      loadConversations();
    };

    // Handle user coming online
    const handleUserOnline = (data) => {
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    };

    // Handle user going offline
    const handleUserOffline = (data) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    };

    // Handle user status list (when requested)
    const handleUserStatusList = (statusList) => {
      const onlineUserIds = statusList
        .filter(status => status.isOnline)
        .map(status => status.userId);
      setOnlineUsers(new Set(onlineUserIds));
    };

    // Register socket listeners
    socket.onNewMessage(handleNewMessage);
    socket.onMessageSent(handleMessageSent);
    socket.onUserOnline(handleUserOnline);
    socket.onUserOffline(handleUserOffline);
    socket.onUserStatusList(handleUserStatusList);

    // Request status for all conversation users when socket connects
    if (conversations.length > 0) {
      const userIds = conversations.map(conv => conv.otherUser.id).filter(Boolean);
      if (userIds.length > 0) {
        socket.getUserStatus(userIds);
      }
    }

    // Cleanup handled by useSocket hook
  }, [socket.isConnected, selectedChatId, user.id, conversations]);

  const loadConversations = async () => {
    try {
      const response = await messageAPI.getConversations();
      setConversations(response.data.data.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async () => {
    try {
      setIsSearching(true);
      const response = await userAPI.searchUsers(searchTerm);
      setSearchResults(response.data.data.users);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatMessagePreview = (message) => {
    if (message.messageType === 'text') {
      return message.lastMessage?.content || message.lastMessage?.decryptedContent || 'Message';
    } else {
      return ` ${message.messageType}`;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const handleChatSelect = (chat: Conversation | ChatUser) => {
    if ('otherUser' in chat) {
      // Existing conversation
      onSelectChat(chat.otherUser);
    } else {
      // New user from search
      onSelectChat(chat);
      setSearchTerm('');
    }
  };

  const handleUserMenuClick = (action: string) => {
    setShowUserMenu(false);
    
    switch (action) {
      case 'profile':
        navigate('/profile');
        break;
      case 'admin':
        navigate('/admin');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'logout':
        logout();
        break;
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">SafeTalk</h1>
          <div className="flex items-center space-x-2">
            {/* <button
              onClick={() => onNewChat?.()}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
             */}
            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="User Menu"
              >
                <User className="w-5 h-5" />
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <button 
                    onClick={() => handleUserMenuClick('profile')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 rounded-t-lg flex items-center space-x-2 text-gray-700"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  {user?.role === 'admin' && (
                    <button 
                      onClick={() => handleUserMenuClick('admin')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-purple-600"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Admin Panel</span>
                    </button>
                  )}
                  {/* <button 
                    onClick={() => handleUserMenuClick('settings')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-gray-700"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button> */}
                  <hr className="border-gray-200" />
                  <button 
                    onClick={() => handleUserMenuClick('logout')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-red-600 rounded-b-lg flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white border border-transparent focus:border-green-500"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {searchTerm && (
          <div className="p-3">
            <div className="text-sm font-medium text-gray-500 mb-2">
              {isSearching ? 'Searching...' : 'Search Results'}
            </div>
            {searchResults.length > 0 ? (
              searchResults.map((user, idx) => (
                <div
                  key={user.id || idx}
                  onClick={() => handleChatSelect(user)}
                  className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="relative w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <span className="font-semibold text-green-600">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                    {/* Online status indicator */}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      onlineUsers.has(user.id) ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {user.username}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
              ))
            ) : !isSearching && searchTerm.length > 2 ? (
              <div className="text-center py-4 text-gray-500">
                No users found
              </div>
            ) : null}
          </div>
        )}

        {!searchTerm && (
          <div>
            {conversations.length > 0 ? (
              conversations.map((conversation, idx) => (
                <div
                  key={conversation.otherUser?.id || idx}
                  onClick={() => handleChatSelect(conversation)}
                  className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 ${
                    selectedChatId === conversation.otherUser.id
                      ? 'bg-green-50 border-l-green-500'
                      : 'border-l-transparent'
                  }`}
                >
                  <div className="relative w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="font-semibold text-green-600 text-lg">
                      {conversation.otherUser.username.charAt(0).toUpperCase()}
                    </span>
                    {/* Online status indicator */}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                      onlineUsers.has(conversation.otherUser.id) ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {conversation.otherUser.username}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatTimestamp(conversation.lastMessage.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.lastMessage.isFromMe && (
                          <span className="mr-1">
                            {conversation.lastMessage.status === 'read' ? '✓✓' : 
                             conversation.lastMessage.status === 'delivered' ? '✓' : '○'}
                          </span>
                        )}
                        {formatMessagePreview(conversation.lastMessage)}
                      </p>
                      
                      {conversation.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-xs rounded-full px-2 py-1 min-w-[1.25rem] h-5 flex items-center justify-center ml-2">
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-medium text-lg mb-2">No conversations yet</h3>
                <p className="text-center text-sm px-4">
                  Start a new conversation by searching for users above
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;