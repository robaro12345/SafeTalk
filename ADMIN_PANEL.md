# SafeTalk Admin Panel

## Overview

The SafeTalk Admin Panel provides comprehensive administrative tools for managing users, monitoring system statistics, and analyzing platform activity. This powerful dashboard helps administrators maintain a secure and efficient messaging platform.

## Features

### 📊 Dashboard
- **Real-time Statistics**
  - Total users, active users, and banned users
  - Message counts (total, last 24h, 7d, 30d)
  - New user registrations by time period
  - Locked accounts overview
  - 2FA method distribution (Email OTP vs TOTP)

- **Top Message Senders**
  - Identify most active users
  - Monitor usage patterns

- **Recent Logins**
  - Track user login activity
  - Monitor authentication events

### 👥 User Management
- **Search & Filter Users**
  - Search by username or email
  - Filter by role (admin/user)
  - Filter by status (active/banned)
  - Paginated results (20 per page)

- **User Actions**
  - View detailed user information
  - Ban/Unban users with reason logging
  - Unlock locked accounts
  - Change user roles (promote/demote)
  - Permanently delete users

- **User Details Modal**
  - Complete user profile
  - Message statistics (sent/received)
  - Account status and 2FA method
  - Join date and last login
  - Quick action buttons

### 📈 Analytics
- **User Growth Analysis**
  - Visual charts showing user registration trends
  - 30-day growth tracking
  - Day-by-day breakdown

- **Message Activity**
  - Message volume over time
  - Activity patterns and trends
  - Visual data representation

## Access Control

### Making a User Admin

To grant admin privileges to a user, run the provided script:

```bash
cd server
node scripts/makeAdmin.js
```

You'll be prompted to enter a username or email, and then confirm the promotion.

### Admin Route Protection

The admin panel is protected by:
1. **Authentication** - User must be logged in
2. **Role-based Authorization** - User must have `role: 'admin'`
3. **Frontend Guard** - Redirects non-admins to chat
4. **Backend Middleware** - API routes verify admin role

## API Endpoints

All admin endpoints require authentication and admin role:

### Statistics
- `GET /api/admin/stats` - Get dashboard statistics

### User Management
- `GET /api/admin/users` - List all users (with filters & pagination)
- `GET /api/admin/users/:userId` - Get detailed user info
- `PUT /api/admin/users/:userId/ban` - Ban/unban a user
- `PUT /api/admin/users/:userId/unlock` - Unlock user account
- `PUT /api/admin/users/:userId/role` - Change user role
- `DELETE /api/admin/users/:userId` - Permanently delete user

### Analytics
- `GET /api/admin/analytics?period=30` - Get analytics data
- `GET /api/admin/activity?limit=50` - Get recent activity

## Security Features

### Action Logging
All admin actions are logged to the console with:
- Admin email performing the action
- Target user
- Action type (ban, unlock, delete, etc.)
- Reason (when provided)

### Protection Mechanisms
- **Cannot self-ban** - Admins cannot ban themselves
- **Cannot ban other admins** - Prevents admin conflicts
- **Cannot delete other admins** - Protects admin accounts
- **Cannot change own role** - Prevents accidental demotion
- **Deletion confirmation** - Requires typing "DELETE" to confirm

### Ban System
- Requires reason for transparency
- Immediate effect (user cannot login)
- Reversible (can unban with reason)
- Preserves user data

### Delete System
- **Permanent action** - Cannot be undone
- Requires double confirmation
- Deletes all user messages
- Removes user from conversations

## User Interface

### Design Features
- **Responsive Design** - Works on desktop and mobile
- **Intuitive Navigation** - Tab-based interface
- **Visual Feedback** - Color-coded badges and status indicators
- **Action Buttons** - Emoji-based quick actions
- **Modal Dialogs** - Detailed user information overlay

### Status Indicators
- ✅ **Active** - User can login and chat
- 🚫 **Banned** - User is banned from platform
- 🔒 **Locked** - Account temporarily locked (failed login attempts)
- 👤 **User** - Regular user role
- 🛡️ **Admin** - Administrator role
- 📧 **Email** - Using email OTP for 2FA
- 📱 **App** - Using authenticator app for 2FA

## Usage Guide

### Accessing the Admin Panel
1. Login as a user with admin role
2. Click the user menu (👤 icon) in chat sidebar
3. Select "Admin Panel" (only visible to admins)
4. Or navigate directly to `/admin`

### Banning a User
1. Go to "Users" tab
2. Find the user in the list
3. Click the 🚫 ban button
4. Enter a reason for the ban
5. Confirm the action

### Unlocking an Account
1. Go to "Users" tab
2. Find locked users (status shows 🔒)
3. Click the 🔓 unlock button
4. Account is immediately unlocked

### Viewing User Details
1. Go to "Users" tab
2. Click the 👁️ view button on any user
3. Modal shows complete user information
4. Perform actions directly from modal

### Deleting a User
1. Go to "Users" tab
2. Click the 🗑️ delete button
3. Confirm by typing "DELETE"
4. User and all messages are permanently removed

## Best Practices

### User Management
- Always provide clear ban reasons
- Review user activity before banning
- Use unlock for temporarily locked accounts
- Only delete as last resort

### Monitoring
- Regularly check dashboard statistics
- Review top senders for abuse
- Monitor login patterns for suspicious activity
- Check analytics for growth trends

### Security
- Keep admin credentials secure
- Limit number of admin users
- Review admin actions regularly
- Document major moderation decisions

## Troubleshooting

### Cannot Access Admin Panel
- Verify you have admin role in database
- Check if token is expired (logout and login again)
- Ensure you're navigating to `/admin` when logged in

### Actions Not Working
- Check browser console for errors
- Verify API endpoints are responding
- Ensure proper authentication headers
- Check server logs for backend errors

### Missing Statistics
- Verify MongoDB connection
- Check if data aggregation queries are working
- Ensure indexes are created on collections

## Future Enhancements

Potential features for future versions:
- Audit log system with persistent storage
- Advanced user filtering (by join date, message count)
- Bulk user actions (ban multiple users)
- Export user/message data
- Real-time dashboard updates
- Email notifications for admin actions
- User suspension (temporary ban with expiry)
- IP-based rate limiting
- Content moderation tools
- Advanced analytics with charts library
- Custom admin roles with granular permissions

## Technical Details

### Frontend
- **Framework**: React with hooks
- **Routing**: React Router v6
- **Styling**: Custom CSS with responsive design
- **State Management**: Local component state
- **API Client**: Axios via centralized API utility

### Backend
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with role-based middleware
- **Query Optimization**: Aggregation pipelines
- **Error Handling**: Centralized error middleware

### Database Queries
- Uses MongoDB aggregation for statistics
- Indexed queries for performance
- Pagination for large datasets
- Parallel queries with Promise.all()

## Support

For issues or questions about the admin panel:
1. Check server logs for backend errors
2. Check browser console for frontend errors
3. Review API responses for error messages
4. Ensure database connection is stable

---

**Note**: The admin panel is a powerful tool. Use administrative privileges responsibly and always consider user privacy and security when taking actions.
