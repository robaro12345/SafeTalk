import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Shield, Mail, User as UserIcon, Calendar, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../utils/api';
import toast from 'react-hot-toast';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [editForm, setEditForm] = useState({
    username: '',
    email: ''
  });
  
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // 2FA change state
  const [show2FAChange, setShow2FAChange] = useState(false);
  const [twoFAForm, setTwoFAForm] = useState({
    twoFAMethod: '',
    currentPassword: ''
  });
  const [totpSetupData, setTotpSetupData] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await userAPI.getProfile();
      const profileData = response.data.data.user;
      setProfile(profileData);
      setEditForm({
        username: profileData.username || '',
        email: profileData.email || ''
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Reset form if canceling
      setEditForm({
        username: profile.username || '',
        email: profile.email || ''
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      
      // Validate username
      if (editForm.username.length < 3) {
        toast.error('Username must be at least 3 characters');
        return;
      }
      
      // Validate email
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(editForm.email)) {
        toast.error('Please enter a valid email');
        return;
      }

      await userAPI.updateProfile({
        username: editForm.username,
        email: editForm.email
      });
      
      toast.success('Profile updated successfully');
      setIsEditing(false);
      await loadProfile();
    } catch (error) {
      console.error('Failed to update profile:', error);
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await userAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      
      toast.success('Password changed successfully');
      setShowPasswordChange(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      const message = error.response?.data?.message || 'Failed to change password';
      toast.error(message);
    }
  };

  const handle2FAMethodChange = async (e) => {
    e.preventDefault();
    
    // Validate
    if (!twoFAForm.twoFAMethod) {
      toast.error('Please select a 2FA method');
      return;
    }
    
    if (!twoFAForm.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    try {
      const response = await userAPI.update2FA({
        twoFAMethod: twoFAForm.twoFAMethod,
        currentPassword: twoFAForm.currentPassword
      });
      
      // If switching to TOTP, show QR code
      if (response.data.totpSetup) {
        setTotpSetupData(response.data.totpSetup);
        toast.success('2FA method updated! Please scan the QR code with your authenticator app.');
      } else {
        toast.success('2FA method updated successfully');
        setShow2FAChange(false);
        setTwoFAForm({
          twoFAMethod: '',
          currentPassword: ''
        });
        await loadProfile();
      }
    } catch (error) {
      console.error('Failed to update 2FA method:', error);
      const message = error.response?.data?.message || 'Failed to update 2FA method';
      toast.error(message);
    }
  };

  const handleCloseTotpSetup = () => {
    setTotpSetupData(null);
    setShow2FAChange(false);
    setTwoFAForm({
      twoFAMethod: '',
      currentPassword: ''
    });
    loadProfile();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Chat</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Profile Settings</h1>
          <div className="w-24"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-green-500 to-blue-500 h-32"></div>
          
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end justify-between -mt-16 mb-6">
              <div className="flex items-end space-x-4">
                <div className="w-32 h-32 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                  <span className="text-5xl font-bold text-green-600">
                    {profile?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">{profile?.username}</h2>
                  <p className="text-gray-600">{profile?.email}</p>
                </div>
              </div>
              
              {!isEditing ? (
                <button
                  onClick={handleEditToggle}
                  className="mb-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="mb-4 flex space-x-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                  </button>
                  <button
                    onClick={handleEditToggle}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Profile Information */}
            <div className="space-y-6">
              {/* Editable Fields */}
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <UserIcon className="w-4 h-4 inline mr-2" />
                      Username
                    </label>
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter username"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter email"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start space-x-3">
                    <UserIcon className="w-5 h-5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">Username</p>
                      <p className="font-medium text-gray-900">{profile?.username}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{profile?.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">2FA Method</p>
                      <p className="font-medium text-gray-900 capitalize">{profile?.twoFAMethod}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">Member Since</p>
                      <p className="font-medium text-gray-900">{formatDate(profile?.createdAt)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Key className="w-5 h-5 mr-2" />
            Security Settings
          </h3>
          
          {/* Password Change Section */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h4 className="text-md font-medium text-gray-800 mb-2">Password</h4>
            {!showPasswordChange ? (
              <div>
                <p className="text-gray-600 mb-4">Keep your account secure by updating your password regularly.</p>
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Change Password
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter current password"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter new password"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Update Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordChange(false);
                      setPasswordForm({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      });
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 2FA Method Change Section */}
          <div>
            <h4 className="text-md font-medium text-gray-800 mb-2">Two-Factor Authentication</h4>
            {!show2FAChange && !totpSetupData ? (
              <div>
                <p className="text-gray-600 mb-2">Current method: <span className="font-medium capitalize">{profile?.twoFAMethod}</span></p>
                <p className="text-gray-600 mb-4">
                  {profile?.twoFAMethod === 'email' 
                    ? 'Switch to TOTP (Authenticator App) for better security.' 
                    : 'Switch to Email OTP if you prefer email verification.'}
                </p>
                <button
                  onClick={() => setShow2FAChange(true)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Change 2FA Method
                </button>
              </div>
            ) : totpSetupData ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-medium text-blue-900 mb-2">Setup TOTP Authenticator</h5>
                  <p className="text-sm text-blue-800 mb-4">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  
                  {/* QR Code */}
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img 
                      src={totpSetupData.qrCode} 
                      alt="TOTP QR Code" 
                      className="w-48 h-48"
                    />
                  </div>
                  
                  {/* Manual Entry */}
                  <div className="mt-4">
                    <p className="text-sm text-blue-800 mb-2">Or enter this key manually:</p>
                    <code className="block bg-white px-3 py-2 rounded border border-blue-200 text-sm font-mono">
                      {totpSetupData.secret}
                    </code>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={handleCloseTotpSetup}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handle2FAMethodChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select 2FA Method
                  </label>
                  <select
                    value={twoFAForm.twoFAMethod}
                    onChange={(e) => setTwoFAForm({ ...twoFAForm, twoFAMethod: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select a method...</option>
                    <option value="email">Email OTP</option>
                    <option value="totp">TOTP (Authenticator App)</option>
                  </select>
                  {twoFAForm.twoFAMethod === 'email' && (
                    <p className="text-sm text-gray-500 mt-2">
                      📧 You'll receive a one-time code via email each time you login.
                    </p>
                  )}
                  {twoFAForm.twoFAMethod === 'totp' && (
                    <p className="text-sm text-gray-500 mt-2">
                      📱 Use an authenticator app (Google Authenticator, Authy, etc.) to generate codes.
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm with Current Password
                  </label>
                  <input
                    type="password"
                    value={twoFAForm.currentPassword}
                    onChange={(e) => setTwoFAForm({ ...twoFAForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter your current password"
                    required
                  />
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Update 2FA Method
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShow2FAChange(false);
                      setTwoFAForm({
                        twoFAMethod: '',
                        currentPassword: ''
                      });
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Account Status</span>
              <span className="font-medium text-green-600">Active</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Role</span>
              <span className="font-medium text-gray-900 capitalize">{profile?.role}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Last Login</span>
              <span className="font-medium text-gray-900">{formatDate(profile?.lastLogin)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Email Verified</span>
              <span className="font-medium text-gray-900">
                {profile?.isEmailVerified ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
