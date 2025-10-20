import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authAPI, userAPI, apiUtils } from '../utils/api';
import cryptoUtils from '../utils/crypto';
import socketService from '../utils/socket';
import toast from 'react-hot-toast';

// Types
interface User {
  id: string;
  username: string;
  email: string;
  role?: string;
  publicKey?: string;
  twoFAMethod?: string;
  twoFAEnabled?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresTwoFA: boolean;
  twoFAMethod: string | null;
  pendingUserId: string | null;
  error: string | null;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  twoFAMethod: string;
  publicKey?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthContextType extends AuthState {
  register: (userData: RegisterData) => Promise<{ success: boolean; totpSetup?: any; user?: User; error?: string }>;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; requiresTwoFA?: boolean; error?: string }>;
  verify2FA: (code: string, password?: string | null) => Promise<{ success: boolean; error?: string }>;
  resendOTP: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  clearError: () => void;
}

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  requiresTwoFA: false,
  twoFAMethod: null,
  pendingUserId: null,
  error: null,
};

// Action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_REQUIRES_2FA: 'LOGIN_REQUIRES_2FA',
  LOGOUT: 'LOGOUT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_USER: 'UPDATE_USER',
} as const;

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User } }
  | { type: 'LOGIN_REQUIRES_2FA'; payload: { twoFAMethod: string; userId: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        requiresTwoFA: false,
        twoFAMethod: null,
        pendingUserId: null,
        error: null,
        isLoading: false,
      };

    case AUTH_ACTIONS.LOGIN_REQUIRES_2FA:
      return {
        ...state,
        requiresTwoFA: true,
        twoFAMethod: action.payload.twoFAMethod,
        pendingUserId: action.payload.userId,
        error: null,
        isLoading: false,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };

    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const userData = apiUtils.getUser();

        if (token && userData) {
          // Verify token is still valid by fetching user profile
          try {
            const response = await userAPI.getProfile();
            const user = response.data.data.user;

            dispatch({
              type: AUTH_ACTIONS.LOGIN_SUCCESS,
              payload: { user }
            });

            // Initialize socket connection
            socketService.connect(token);
          } catch (error) {
            // Token is invalid, clear auth data
            apiUtils.clearAuth();
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
          }
        } else {
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Register function
  const register = async (userData: RegisterData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      // If publicKey is not already provided (e.g. Register page already generated it), generate here
      let publicKeyPem = userData.publicKey || null;
      let privateKeyJwk: any = null;

      if (!publicKeyPem) {
        try {
          const kp = await cryptoUtils.generateKeyPair();
          publicKeyPem = kp.publicKeyPem;
          privateKeyJwk = kp.privateKeyJwk;
        } catch (e) {
          console.error('Key generation failed:', e);
          dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Failed to generate encryption keys' });
          toast.error('Failed to generate encryption keys. Please try again or use a different browser.');
          return { success: false, error: 'Key generation failed' };
        }
      }

      const registrationPayload = { ...userData, publicKey: publicKeyPem };

      console.log('Calling register API with:', registrationPayload);
      const response = await authAPI.register(registrationPayload);
      console.log('Register API response:', response.data);
      
      const { success, message, totpSetup, user } = response.data;

      if (success) {
        toast.success(message || 'Registration successful!');
        // Store private key JWK locally for later decryption if we generated it here
        try {
          if (privateKeyJwk) {
            localStorage.setItem('privateKeyJwk', JSON.stringify(privateKeyJwk));
          }
        } catch (e) {
          console.warn('Failed to store private key locally:', e);
        }

        console.log('Returning from register function:', { success: true, totpSetup, user });
        return { success: true, totpSetup, user };
      } else {
        const errorMessage = response.data.message || 'Registration failed';
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.message || 'Registration failed';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Login function
  const login = async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const response = await authAPI.login(credentials);
      const { requiresTwoFA, twoFAMethod, userId, message } = response.data;

      if (requiresTwoFA) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_REQUIRES_2FA,
          payload: { twoFAMethod, userId }
        });
        toast.success(message || 'Please complete 2FA verification');
        return { success: true, requiresTwoFA: true };
      }

      // Should not reach here as 2FA is mandatory, but handle just in case
      toast.error('Two-factor authentication is required');
      return { success: false, error: 'Two-factor authentication is required' };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Verify 2FA function
  const verify2FA = async (code: string, password: string | null = null) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

      const response = await authAPI.verify2FA({
        userId: state.pendingUserId,
        code
      });

  const { user, accessToken } = response.data;

  // Store auth data
  localStorage.setItem('accessToken', accessToken);
  apiUtils.setUser(user);

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user }
      });

      // Initialize socket connection
      socketService.connect(accessToken);

      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || '2FA verification failed';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Resend OTP function
  const resendOTP = async () => {
    try {
      await authAPI.resendOTP({ userId: state.pendingUserId });
      toast.success('New OTP sent to your email');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to resend OTP';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Disconnect socket
      socketService.disconnect();

      // Call logout API to clear server-side session
      try {
        await authAPI.logout();
      } catch (error) {
        console.error('Logout API error:', error);
        // Continue with client-side logout even if server call fails
      }

      // Clear local storage
      apiUtils.clearAuth();

      // Update state
      dispatch({ type: AUTH_ACTIONS.LOGOUT });

      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      apiUtils.clearAuth();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Update user profile
  const updateUser = (userData: Partial<User>) => {
    dispatch({
      type: AUTH_ACTIONS.UPDATE_USER,
      payload: userData
    });
    apiUtils.setUser({ ...state.user, ...userData });
  };

  // Clear errors
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Context value
  const value: AuthContextType = {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    requiresTwoFA: state.requiresTwoFA,
    twoFAMethod: state.twoFAMethod,
    pendingUserId: state.pendingUserId,
    error: state.error,

    // Actions
    register,
    login,
    verify2FA,
    resendOTP,
    logout,
    updateUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;