import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface InputBoxProps {
  onSendMessage: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
  isDisabled?: boolean;
  placeholder?: string;
}

const InputBox: React.FC<InputBoxProps> = ({ 
  onSendMessage, 
  onTyping, 
  isDisabled = false, 
  placeholder = "Type a message..." 
}) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Handle typing indicators
  useEffect(() => {
    if (message.trim() && !isTyping) {
      setIsTyping(true);
      onTyping?.(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    if (message.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTyping?.(false);
      }, 2000);
    } else if (isTyping) {
      setIsTyping(false);
      onTyping?.(false);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, isTyping, onTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isDisabled && onSendMessage) {
      onSendMessage(trimmedMessage);
      setMessage('');
      setIsTyping(false);
      onTyping?.(false);
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <div className="flex items-end space-x-3">
        {/* Message Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isDisabled ? "Select a conversation to start messaging" : placeholder}
            disabled={isDisabled}
            className="w-full px-4 py-2 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isDisabled || !message.trim()}
          className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300"
          title="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Character count */}
      {message.length > 900 && (
        <div className="text-right mt-2">
          <span className={`text-xs ${message.length > 1000 ? 'text-red-500' : 'text-gray-500'}`}>
            {message.length}/1000
          </span>
        </div>
      )}
    </div>
  );
};

export default InputBox;