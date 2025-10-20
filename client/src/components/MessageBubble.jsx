import React, { useState } from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';
import cryptoUtils from '../utils/crypto';

const MessageBubble = ({ message, isOwn, onMessageSelect }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusIcon = (status) => {
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
                return <p className="text-sm italic text-gray-500">[Encrypted message — you don't have the private key]</p>;
              }

              // Fallback to raw content (useful for plaintext messages)
              return <p className="text-sm">{message.content || message.text}</p>;
            })()}
        </div>

          {/* Try decrypt button (developer/debug) */}
          <DecryptControls message={message} />

        {/* Message Info */}
        <div className={`flex items-center justify-end mt-1 space-x-1 text-xs ${
          isOwn ? 'text-green-100' : 'text-gray-500'
        }`}>
          <span>{formatTime(message.timestamp)}</span>
          {isOwn && getStatusIcon(message.status)}
        </div>

        {/* Error State */}
        {/* decryption errors removed */}

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

// Small debug component to attempt decryption using stored privateKeyJwk
const DecryptControls = ({ message }) => {
  const [attempting, setAttempting] = useState(false);
  const [result, setResult] = useState(null);

  const tryDecrypt = async () => {
    setResult(null);
    setAttempting(true);

    try {
      const jwkStr = localStorage.getItem('privateKeyJwk');
      if (!jwkStr) {
        setResult({ ok: false, msg: 'No private key stored in localStorage' });
        setAttempting(false);
        return;
      }

      const jwk = JSON.parse(jwkStr);
      const decrypted = await cryptoUtils.decryptWithPrivateKeyJwk(jwk, message.content);
      setResult({ ok: true, msg: decrypted });
    } catch (e) {
      setResult({ ok: false, msg: e.message || 'Decryption failed' });
    } finally {
      setAttempting(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={tryDecrypt}
        className="text-xs underline text-gray-400 hover:text-gray-600"
        disabled={attempting}
      >
        {attempting ? 'Trying...' : 'Try decrypt'}
      </button>
      {result && (
        <div className={`mt-1 text-xs ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
          {result.msg}
        </div>
      )}
    </div>
  );
};