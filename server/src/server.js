import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// Import configurations
import config from './config/index.js';
import connectDB from './config/database.js';

// Import middleware
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/validation.js';

// Import routes
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import debugRoutes from './routes/debug.js';

// Import socket configuration
import { initializeSocket } from './socket.js';

// Create Express app
const app = express();

// Create HTTP server
const server = createServer(app);

// Connect to MongoDB
connectDB();

// Trust proxy for rate limiting (if behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "http://localhost:5173", "http://127.0.0.1:5173"],
      styleSrc: ["'self'", "'unsafe-inline'", "http://localhost:5173"],
      scriptSrc: ["'self'", "http://localhost:5173"],
      imgSrc: ["'self'", "data:", "https:", "http://localhost:5173"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5173", "ws://localhost:5000", "wss://localhost:5000"],
      fontSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests from the same origin (null) and from localhost
    const allowedOrigins = [
      config.clientUrl, 
      'http://localhost:5173', 
      'http://127.0.0.1:5173'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
app.use(generalLimiter);

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SafeTalk server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
// Temporary debug routes (remove in production)
app.use('/api/debug', debugRoutes);

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SafeTalk API',
    version: '1.0.0',
    description: 'Secure end-to-end encrypted chat application with 2FA',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        verify2fa: 'POST /api/auth/verify-2fa',
        resendOtp: 'POST /api/auth/resend-otp',
        logout: 'POST /api/auth/logout'
      },
      messages: {
        send: 'POST /api/messages/send',
        conversation: 'GET /api/messages/conversation/:userId',
        conversations: 'GET /api/messages/conversations',
        updateStatus: 'PUT /api/messages/:messageId/status',
        delete: 'DELETE /api/messages/:messageId'
      },
      users: {
        profile: 'GET /api/users/profile',
        search: 'GET /api/users/search',
        getUser: 'GET /api/users/:userId',
        changePassword: 'PUT /api/users/change-password',
        update2FA: 'PUT /api/users/update-2fa'
      }
    },
    security: {
      encryption: 'RSA-2048 + AES-256-GCM',
      authentication: 'JWT with RS256',
      twoFactor: 'Email OTP or TOTP (Authenticator App)',
      passwordHashing: 'Argon2id'
    }
  });
});

// Initialize Socket.io
const io = initializeSocket(server);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🔄 Received shutdown signal, starting graceful shutdown...');
  
  server.close(() => {
    console.log('🔒 HTTP server closed');
    
    // Close database connection
    import('mongoose').then(mongoose => {
      mongoose.default.connection.close(() => {
        console.log('🔒 Database connection closed');
        process.exit(0);
      });
    });
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  // Don't exit the process in production, just log
  if (config.nodeEnv !== 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log('\n🚀 SafeTalk Server Starting...');
  console.log('═'.repeat(50));
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${config.nodeEnv}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🔐 Frontend URL: ${config.clientUrl}`);
  console.log('═'.repeat(50));
  console.log('🛡️  Security Features:');
  console.log('   ✅ End-to-End Encryption (RSA + AES)');
  console.log('   ✅ Mandatory 2FA (Email OTP / TOTP)');
  console.log('   ✅ JWT Authentication (RS256)');
  console.log('   ✅ Password Hashing (Argon2)');
  console.log('   ✅ Rate Limiting & Security Headers');
  console.log('   ✅ Real-time Messaging (Socket.io)');
  console.log('═'.repeat(50));
  console.log('📝 Ready for connections!\n');
});

export default app;