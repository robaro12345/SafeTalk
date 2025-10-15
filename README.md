# SafeTalk - Secure End-to-End Encrypted Chat Application

<div align="center">

![SafeTalk Logo](https://img.shields.io/badge/SafeTalk-Secure%20Messaging-green?style=for-the-badge&logo=shield&logoColor=white)

**A full-stack MERN secure chat application with end-to-end encryption, JWT authentication, and mandatory two-factor authentication (2FA)**

[![React](https://img.shields.io/badge/React-19.1.1-blue?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Backend-green?logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-green?logo=mongodb)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-Real--time-black?logo=socket.io)](https://socket.io/)

</div>

## 🔐 Security Features

SafeTalk implements industry-standard security measures to ensure your conversations remain private:

- **🔒 End-to-End Encryption**: RSA-2048 + AES-256-GCM encryption
- **🛡️ Mandatory 2FA**: Email OTP or TOTP (Google Authenticator)
- **🔑 Zero-Knowledge Architecture**: Server never sees plaintext messages
- **🚀 JWT Authentication**: RS256 signing with refresh tokens
- **⚡ Password Security**: Argon2id hashing with salt
- **🛠️ Security Headers**: Helmet.js + rate limiting + CORS

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Security Architecture](#-security-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Security Mechanisms](#-security-mechanisms)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Core Functionality
- **User Registration & Authentication**: Secure account creation with 2FA setup
- **Real-time Messaging**: Instant message delivery with Socket.io
- **Contact Management**: Search and add users by username or email
- **Message History**: Encrypted conversation storage and retrieval
- **Typing Indicators**: Real-time typing status updates
- **Read Receipts**: Message delivery and read confirmations
- **Responsive UI**: WhatsApp-like interface with Tailwind CSS

### Security Features
- **End-to-End Encryption**: Messages encrypted on client, decrypted on recipient
- **RSA Key Management**: Automatic key pair generation and secure storage
- **AES Message Encryption**: Per-message AES keys for perfect forward secrecy
- **Two-Factor Authentication**: Choose between Email OTP or Authenticator App
- **Account Security**: Rate limiting, login attempt tracking, account lockout
- **Secure Headers**: CSP, HSTS, and other security headers via Helmet.js

### User Experience
- **Clean Interface**: Modern, intuitive chat interface
- **Real-time Updates**: Live message delivery and status updates
- **Search Functionality**: Find users and conversations quickly
- **Responsive Design**: Works on desktop and mobile devices
- **Toast Notifications**: User-friendly error and success messages

## 🛠️ Tech Stack

### Frontend
- **React 19**: Modern JavaScript library for building user interfaces
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React Router**: Client-side routing for single-page application
- **Socket.io Client**: Real-time bidirectional event-based communication
- **Lucide React**: Beautiful & consistent icon toolkit
- **React Hot Toast**: Smooth toast notifications

### Backend
- **Node.js**: JavaScript runtime for server-side development
- **Express.js**: Fast, unopinionated web framework for Node.js
- **MongoDB**: NoSQL database for flexible data storage
- **Mongoose**: MongoDB object modeling for Node.js
- **Socket.io**: Real-time communication between client and server
- **JWT**: JSON Web Tokens for secure authentication

### Security & Encryption
- **Argon2**: Password hashing function (winner of PHC)
- **Node Forge**: RSA encryption and key management
- **Crypto-JS**: AES encryption for message content
- **Speakeasy**: TOTP implementation for authenticator apps
- **Helmet.js**: Security headers middleware
- **Express Rate Limit**: Rate limiting middleware

### Development & Utilities
- **Nodemailer**: Email sending for OTP delivery
- **QRCode**: QR code generation for TOTP setup
- **Joi**: Object schema validation
- **CORS**: Cross-origin resource sharing
- **Dotenv**: Environment variable management

## 🔒 Security Architecture

### Encryption Flow

1. **Key Generation**: RSA-2048 key pair generated during registration
2. **Key Storage**: Public key stored in database, private key encrypted with user password
3. **Message Encryption**: 
   - Generate random AES-256 key for each message
   - Encrypt message content with AES-GCM
   - Encrypt AES key with recipient's RSA public key
   - Store only ciphertext, IV, and encrypted AES key on server
4. **Message Decryption**:
   - Decrypt AES key using recipient's RSA private key
   - Decrypt message content using AES key and IV

### Authentication Flow

1. **Registration**: User creates account with email, username, password
2. **2FA Setup**: User selects Email OTP or TOTP method
3. **Login**: User enters credentials, server verifies password
4. **2FA Verification**: User completes second factor authentication
5. **Token Issuance**: Server issues JWT access token and httpOnly refresh token
6. **Session Management**: Tokens used for API authentication and Socket.io connection

## 🚀 Installation

### Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (v6 or higher)
- **npm** or **yarn**
- **Git**

### Clone Repository

```bash
git clone https://github.com/your-username/SafeTalk.git
cd SafeTalk
```

### Backend Setup

1. **Navigate to server directory**:
   ```bash
   cd server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   copy .env.template .env
   ```
   Edit `.env` file with your configuration (see [Configuration](#configuration) section)

4. **Start the server**:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

### Frontend Setup

1. **Navigate to client directory**:
   ```bash
   cd client
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   copy .env.template .env
   ```
   Edit `.env` file with your configuration

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## ⚙️ Configuration

### Server Configuration (.env)

```env
# Database
MONGODB_URI=mongodb://localhost:27017/safetalk

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Email Configuration (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Application Settings
APP_NAME=SafeTalk
FRONTEND_URL=http://localhost:5173
```

### Client Configuration (.env)

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

# App Configuration
VITE_APP_NAME=SafeTalk
VITE_APP_VERSION=1.0.0
```

### Email Setup (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account Settings → Security → App passwords
   - Select "Mail" and generate password
   - Use this password in `EMAIL_PASS`

### MongoDB Setup

**Option 1: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Start MongoDB service
mongod --dbpath /your/data/directory
```

**Option 2: MongoDB Atlas (Cloud)**
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create cluster and get connection string
3. Replace `MONGODB_URI` in `.env`

## 🎯 Usage

### Getting Started

1. **Start the application**:
   - Backend: `cd server && npm run dev`
   - Frontend: `cd client && npm run dev`

2. **Open your browser** and navigate to `http://localhost:5173`

3. **Register a new account**:
   - Fill in email, username, and secure password
   - Choose 2FA method (Email OTP or Authenticator App)
   - Complete registration process

4. **Login and verify 2FA**:
   - Enter your credentials
   - Complete 2FA verification
   - Access the chat interface

### Using the Chat Interface

1. **Find users**: Use the search bar to find other users
2. **Start conversations**: Click on a user to start chatting
3. **Send messages**: Type and send encrypted messages
4. **View conversations**: All conversations appear in the sidebar
5. **Real-time features**: See typing indicators and read receipts

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "SecurePassword123!",
  "twoFAMethod": "email"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Verify 2FA
```http
POST /api/auth/verify-2fa
Content-Type: application/json

{
  "userId": "user_id_here",
  "code": "123456"
}
```

### Message Endpoints

#### Send Message
```http
POST /api/messages/send
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "receiverId": "recipient_user_id",
  "ciphertext": "encrypted_message_content",
  "iv": "initialization_vector",
  "encryptedAesKey": "rsa_encrypted_aes_key"
}
```

#### Get Conversation
```http
GET /api/messages/conversation/{userId}
Authorization: Bearer <access_token>
```

### User Endpoints

#### Search Users
```http
GET /api/users/search?query=username
Authorization: Bearer <access_token>
```

#### Get Profile
```http
GET /api/users/profile
Authorization: Bearer <access_token>
```

### Socket.io Events

#### Client → Server
- `join_conversation`: Join a conversation room
- `send_message`: Send encrypted message
- `typing_start`: Start typing indicator
- `typing_stop`: Stop typing indicator
- `message_read`: Mark message as read

#### Server → Client
- `new_message`: Receive new message
- `message_sent`: Message sent confirmation
- `user_typing`: Typing indicator updates
- `user_online`: User came online
- `user_offline`: User went offline

## 🔐 Security Mechanisms

### Password Security
- **Argon2id hashing**: Industry-standard password hashing
- **Salt generation**: Unique salt per password
- **Strength requirements**: Enforced password complexity
- **Rate limiting**: Login attempt restrictions

### Encryption Details
- **RSA-OAEP 2048-bit**: Asymmetric encryption for key exchange
- **AES-256-GCM**: Symmetric encryption for message content
- **Perfect Forward Secrecy**: New AES key per message
- **IV randomization**: Unique initialization vector per message

### Authentication Security
- **JWT with RS256**: Cryptographically signed tokens
- **Refresh token rotation**: Secure token refresh mechanism
- **HttpOnly cookies**: Secure refresh token storage
- **Token expiration**: Short-lived access tokens

### Network Security
- **HTTPS enforcement**: TLS encryption in transit
- **CORS protection**: Cross-origin request filtering
- **Rate limiting**: API endpoint protection
- **Security headers**: CSP, HSTS, X-Frame-Options

### 2FA Implementation
- **Email OTP**: 6-digit codes with 3-minute expiry
- **TOTP support**: RFC 6238 compliant (30-second window)
- **QR code generation**: Easy authenticator app setup
- **Backup mechanisms**: Account recovery options

## 🛡️ Security Best Practices

### For Users
- Use a strong, unique password
- Enable 2FA with an authenticator app when possible
- Keep your devices and browsers updated
- Log out from shared or public computers
- Never share your verification codes

### For Developers
- Regularly update dependencies for security patches
- Monitor for vulnerabilities in third-party packages
- Implement proper logging and monitoring
- Use environment variables for sensitive configuration
- Regular security audits and penetration testing

## 📁 Project Structure

```
SafeTalk/
├── server/                 # Backend application
│   ├── src/
│   │   ├── config/        # Database and app configuration
│   │   ├── middleware/    # Express middleware (auth, validation, etc.)
│   │   ├── models/        # MongoDB schemas (User, Message, EmailOTP)
│   │   ├── routes/        # API route handlers
│   │   ├── utils/         # Utility functions (crypto, jwt, email)
│   │   ├── socket.js      # Socket.io configuration
│   │   └── server.js      # Main server file
│   ├── package.json       # Server dependencies
│   └── .env.template      # Environment variables template
├── client/                # Frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context (auth)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions (api, crypto, socket)
│   │   └── App.jsx        # Main app component
│   ├── package.json       # Client dependencies
│   └── .env.template      # Environment variables template
└── README.md              # Project documentation
```

## 🤝 Contributing

We welcome contributions to SafeTalk! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines
- Follow the existing code style and conventions
- Add tests for new functionality
- Update documentation for significant changes
- Ensure all security best practices are followed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Argon2 Team**: For the excellent password hashing algorithm
- **Socket.io Team**: For real-time communication capabilities
- **MongoDB Team**: For the flexible NoSQL database
- **React Team**: For the powerful frontend framework
- **Tailwind CSS**: For the utility-first CSS framework
- **Security Community**: For continuous research and improvements in web security

## 📞 Support

If you encounter any issues or have questions:

1. **Check the documentation** above for common solutions
2. **Search existing issues** in the GitHub repository
3. **Create a new issue** with detailed information about your problem
4. **Contact the maintainers** for security-related concerns

---

<div align="center">

**SafeTalk - Secure, Private, Reliable**

Built with ❤️ for privacy and security

</div>