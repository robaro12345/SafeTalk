import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';

interface Message {
  id?: string;
  content?: string;
  text?: string;
  decryptedContent?: string;
  decryptionError?: boolean;
  timestamp: string | Date;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onMessageSelect?: (message: Message) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, onMessageSelect }) => {
  const formatTime = (timestamp: string | Date): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Clock className="w-3 h-3" />;
      case 'delivered':
        return <Check className="w-3 h-3" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const handleClick = () => {
    if (onMessageSelect) {
      onMessageSelect(message);
    }
  };

  return (
    <div
      className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}
      onClick={handleClick}
    >
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl relative cursor-pointer hover:shadow-md transition-shadow ${
          isOwn
            ? 'bg-green-500 text-white rounded-br-sm'
            : 'bg-gray-200 text-gray-900 rounded-bl-sm'
        }`}
      >
        {/* Message Content */}
        <div className="break-words">
          {(() => {
            // Prefer decrypted content. If decryption failed, show an explicit placeholder
            const decrypted = message.decryptedContent;
            const decryptionError = message.decryptionError;

            if (decrypted) {
              return <p className="text-sm">{decrypted}</p>;
            }

            if (decryptionError) {
              return <p className="text-sm italic opacity-70">[Message could not be decrypted]</p>;
            }

            // Fallback to raw content (useful for plaintext messages)
            return <p className="text-sm">{message.content || message.text}</p>;
          })()}
        </div>

        {/* Message Info */}
        <div className={`flex items-center justify-end mt-1 space-x-1 text-xs ${
          isOwn ? 'text-green-100' : 'text-gray-500'
        }`}>
          <span>{formatTime(message.timestamp)}</span>
          {isOwn && getStatusIcon(message.status)}
        </div>

        {/* Delivery Status for Failed Messages */}
        {message.status === 'failed' && isOwn && (
          <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-600">
            <p className="font-medium">Message failed to send</p>
            <button className="underline hover:no-underline">
              Tap to retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;