import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Mail, Smartphone, RefreshCw, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Verify2FA = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verify2FA, resendOTP, twoFAMethod, pendingUserId, isLoading } = useAuth();
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const userEmail = location.state?.email || '';

  // Redirect if no pending 2FA
  useEffect(() => {
    if (!pendingUserId) {
      navigate('/login');
    }
  }, [pendingUserId, navigate]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (twoFAMethod === 'email' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      setCanResend(true);
    }
  }, [timeLeft, twoFAMethod]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle input change
  const handleInputChange = (index, value) => {
    if (value.length > 1) return; // Only single digit
    if (value && !/^\d$/.test(value)) return; // Only numbers

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }

    // Auto-submit when all fields are filled
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleSubmit(newCode.join(''));
    }
  };

  // Handle key down events
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5].focus();
      
      // Auto-submit
      setTimeout(() => handleSubmit(pastedData), 100);
    }
  };

  // Submit verification
  const handleSubmit = async (verificationCode = null) => {
    const codeToVerify = verificationCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    // Verify 2FA code (no password required)
    const result = await verify2FA(codeToVerify);
    
    if (result.success) {
      navigate('/chat');
    } else {
      // Clear the form on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0].focus();
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    const result = await resendOTP();
    if (result.success) {
      setTimeLeft(180);
      setCanResend(false);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0].focus();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={() => navigate('/login')}
            className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            {twoFAMethod === 'email' ? (
              <Mail className="w-8 h-8 text-green-600" />
            ) : (
              <Smartphone className="w-8 h-8 text-green-600" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Identity</h1>
          <p className="text-gray-600">
            {twoFAMethod === 'email' 
              ? `We've sent a 6-digit code to ${userEmail}`
              : 'Enter the 6-digit code from your authenticator app'
            }
          </p>
        </div>

        {/* Code Input */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
            Verification Code
          </label>
          <div className="flex justify-center space-x-2">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                autoFocus={index === 0}
              />
            ))}
          </div>
        </div>

        {/* Timer and Resend (Email OTP only) */}
        {twoFAMethod === 'email' && (
          <div className="text-center mb-6">
            {timeLeft > 0 ? (
              <p className="text-sm text-gray-600">
                Code expires in <span className="font-mono font-bold text-red-600">{formatTime(timeLeft)}</span>
              </p>
            ) : (
              <p className="text-sm text-red-600">Code has expired</p>
            )}
            
            <button
              onClick={handleResendOTP}
              disabled={!canResend || isLoading}
              className="mt-2 flex items-center justify-center mx-auto px-4 py-2 text-sm text-green-600 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              {canResend ? 'Resend Code' : 'Resend available after expiry'}
            </button>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={() => handleSubmit()}
          disabled={isLoading || code.some(digit => digit === '')}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </button>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Security Notice</p>
              {twoFAMethod === 'email' ? (
                <p>Never share your verification code with anyone. SafeTalk will never ask for your code.</p>
              ) : (
                <p>Use the code from your authenticator app. The code refreshes every 30 seconds.</p>
              )}
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Having trouble?{' '}
            <button 
              onClick={() => navigate('/login')}
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Go back to login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Verify2FA;