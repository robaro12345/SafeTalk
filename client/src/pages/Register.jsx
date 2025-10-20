import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import cryptoUtils from '../utils/crypto';

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    twoFAMethod: 'email'
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    // Check password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(formData.password)) {
      toast.error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      return;
    }

    const { confirmPassword, ...registrationData } = formData;

    // Generate RSA key pair client-side and attach publicKey to registration payload
    try {
      const { publicKeyPem, privateKeyJwk } = await cryptoUtils.generateKeyPair();
      // store private key locally (so the user can decrypt after reload)
      localStorage.setItem('privateKeyJwk', JSON.stringify(privateKeyJwk));
      registrationData.publicKey = publicKeyPem;
    } catch (err) {
      console.error('Key generation failed on Register page:', err);
      toast.error('Failed to generate encryption keys. Try again or use another browser.');
      return;
    }

    const result = await register(registrationData);

    if (result.success) {
      // Check if user selected TOTP and we have TOTP setup data
      if (formData.twoFAMethod === 'totp' && result.totpSetup) {
        // Redirect to Setup2FA page with TOTP data
        navigate('/setup-2fa', {
          state: { 
            totpSetup: result.totpSetup,
            email: formData.email,
            username: formData.username
          }
        });
      } else {
        // Email 2FA selected or no TOTP setup, redirect to login
        navigate('/login', {
          state: { 
            message: 'Registration successful! Please check your email for verification.',
            email: formData.email
          }
        });
      }
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Join SafeTalk</h1>
          <p className="text-gray-600">Create your secure messaging account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {/* Username Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Choose a username"
                pattern="^[-A-Za-z0-9_]*$"
                minLength={3}
                maxLength={30}
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">3-30 characters, letters, numbers, underscore, and hyphens only</p>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Create a strong password"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">At least 8 characters with uppercase, lowercase, number & special character</p>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Confirm your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* 2FA Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Two-Factor Authentication Method
            </label>
            <div className="space-y-3">
              <label className="flex items-center p-3 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="twoFAMethod"
                  value="email"
                  checked={formData.twoFAMethod === 'email'}
                  onChange={handleInputChange}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Email OTP</div>
                  <div className="text-sm text-gray-600">Receive codes via email</div>
                </div>
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="twoFAMethod"
                  value="totp"
                  checked={formData.twoFAMethod === 'totp'}
                  onChange={handleInputChange}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">Authenticator App</div>
                  <div className="text-sm text-gray-600">Use Google Authenticator or similar</div>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Test Button for Setup2FA Route */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-800 mb-2 font-medium">Test Setup2FA Route:</p>
          <button
            type="button"
            onClick={() => {
              const mockTotpSetup = {
                secret: 'JBSWY3DPEHPK3PXP',
                qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                manualEntryKey: 'JBSWY3DPEHPK3PXP'
              };
              
              navigate('/setup-2fa', {
                state: { 
                  totpSetup: mockTotpSetup,
                  email: 'test@example.com',
                  username: 'testuser'
                }
              });
            }}
            className="w-full bg-yellow-600 text-white py-2 rounded-lg font-semibold hover:bg-yellow-700 transition-colors text-sm"
          >
            Test Setup2FA Page (Mock Data)
          </button>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-green-600 font-semibold hover:text-green-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;