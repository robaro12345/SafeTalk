import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Copy, Check, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const Setup2FA = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [totpSetup, setTotpSetup] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegeneration, setIsRegeneration] = useState(false);

  useEffect(() => {
    // Get TOTP setup data from location state
    const setupData = location.state?.totpSetup;
    const regeneration = location.state?.isRegeneration;
    
    if (!setupData) {
      const redirectPath = regeneration ? '/regenerate-totp' : '/register';
      const errorMessage = regeneration 
        ? 'No TOTP setup data found. Please try regenerating again.'
        : 'No TOTP setup data found. Please try registering again.';
      
      toast.error(errorMessage);
      navigate(redirectPath);
      return;
    }

    setTotpSetup(setupData);
    setIsRegeneration(!!regeneration);
  }, [location.state, navigate]);

  const handleCopySecret = async () => {
    if (!totpSetup?.manualEntryKey) return;

    try {
      await navigator.clipboard.writeText(totpSetup.manualEntryKey);
      setCopied(true);
      toast.success('Secret copied to clipboard!');
      
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSetupComplete = () => {
    setIsLoading(true);
    
    setTimeout(() => {
      const message = isRegeneration 
        ? 'TOTP regenerated successfully! Use your new authenticator setup to login.'
        : 'TOTP setup completed! Use your authenticator app to login.';
      
      navigate('/login', {
        state: { 
          message,
          email: location.state?.email 
        }
      });
    }, 1000);
  };

  const handleGoBack = () => {
    const backPath = isRegeneration ? '/regenerate-totp' : '/register';
    navigate(backPath);
  };

  if (!totpSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-4">Setup Required</h1>
          <p className="text-gray-600 mb-6">
            This page requires TOTP setup data. Please start from registration or TOTP regeneration.
          </p>
          <div className="space-y-3">
            <Link
              to="/register"
              className="block w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
            >
              Register New Account
            </Link>
            <Link
              to="/regenerate-totp"
              className="block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Regenerate TOTP
            </Link>
            <Link
              to="/login"
              className="block w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isRegeneration ? 'New Authenticator Setup' : 'Setup Authenticator'}
          </h1>
          <p className="text-gray-600">
            {isRegeneration 
              ? 'Scan the QR code with your authenticator app to complete TOTP regeneration'
              : 'Scan the QR code with your authenticator app to complete registration'
            }
          </p>
        </div>

        <div className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 border-2 border-gray-200 rounded-xl shadow-sm">
              <img 
                src={totpSetup.qrCode} 
                alt="TOTP QR Code"
                className="w-48 h-48 rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  toast.error('Failed to load QR code');
                }}
              />
            </div>
          </div>

          {/* Manual Entry Section */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Manual entry key:</p>
              <button
                onClick={handleCopySecret}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <code className="text-xs bg-white px-3 py-2 rounded border break-all block font-mono text-gray-800">
              {totpSetup.manualEntryKey}
            </code>
          </div>

          {/* Setup Instructions */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-2">Setup Steps:</p>
            <ol className="text-sm text-blue-800 space-y-1">
              <li className="flex items-start">
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">1</span>
                Install Google Authenticator, Authy, or similar app
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">2</span>
                Scan the QR code or enter the key manually
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">3</span>
                Save SafeTalk in your authenticator app
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">4</span>
                Click "Complete Setup" to finish registration
              </li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSetupComplete}
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Completing Setup...
                </>
              ) : (
                'Complete Setup'
              )}
            </button>

            <button
              onClick={handleGoBack}
              disabled={isLoading}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isRegeneration ? 'Back to Regenerate TOTP' : 'Back to Registration'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <div className="flex items-start">
            <Shield className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Important</p>
              <p>Save your authenticator setup before proceeding. You'll need it to login to your account.</p>
            </div>
          </div>
        </div>

        {/* Alternative Options */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-gray-600 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-green-600 font-semibold hover:text-green-700">
              Sign in
            </Link>
          </p>
          <p className="text-gray-600 text-sm">
            Lost access to your authenticator?{' '}
            <Link to="/regenerate-totp" className="text-blue-600 font-semibold hover:text-blue-700">
              Regenerate TOTP
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Setup2FA;