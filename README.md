# AnaChat - Secure Real-Time Chat Application

A modern, secure chat application with end-to-end encryption, real-time messaging, group chats, and admin controls. Built with React (Vite), Express.js, Socket.IO, and MongoDB.

## ✨ Features

- ✅ **User Authentication** - Email/mobile signup & login with JWT
- ✅ **Real-Time Messaging** - Socket.IO powered instant messaging
- ✅ **Group Chats** - Create and manage group conversations
- ✅ **Message Reactions** - React to messages with emojis
- ✅ **Message Replies** - Reply to specific messages
- ✅ **User Blocking** - Block users to prevent communication
- ✅ **Admin Console** - Manage users, chats, and audit logs
- ✅ **End-to-End Encryption** - Secure message content
- ✅ **User Activity** - Track online status and last seen time
- ✅ **Audit Logging** - Complete admin action trail
- ✅ **Google OAuth** - Social login integration
- ✅ **Responsive Design** - Mobile-friendly interface with Tailwind CSS
- ✅ **Production Ready** - Deployed on Render (backend) & Vercel (frontend)

## 🏗️ Architecture

```
┌─────────────────────────┐
│  Frontend (Vercel)      │
│  https://chat.myana.site │
│  React + Vite           │
└────────────┬────────────┘
             │ HTTPS
             ├─ API Calls ──────────┐
             │ Socket.IO Connections│
             │                      ▼
┌────────────────────────────────────────────────┐
│  Backend (Render)                              │
│  https://ana-chat.onrender.com                 │
│  Express.js + Socket.IO                        │
└────────────────────────┬───────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  MongoDB Atlas         │
            │  (Cloud Database)      │
            └────────────────────────┘
```

## 🚀 Quick Start

### Local Development

**Prerequisites:**
- Node.js v16+
- MongoDB (local or Atlas)
- Git

**Setup:**

```bash
# 1. Clone repository
git clone <your-repo-url>
cd ankit

# 2. Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# 3. Setup environment variables
# Backend - create backend/.env
# Frontend - create frontend/.env
# See .env.example files for template

# 4. Start development servers

# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm run dev
```

Your app will be at: `http://localhost:5173`

## 📝 Environment Setup

### Local Development (.env files)

**Backend** (`backend/.env`):
```env
MONGODB_URI=mongodb://localhost:27017/anachat
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174
GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET=dev_secret_change_this
JWT_REFRESH_SECRET=dev_refresh_secret
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Production Configuration

See [PRODUCTION_CONFIG.md](./PRODUCTION_CONFIG.md) for production URLs and environment setup.

## 📦 Project Structure

```
ankit/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── api/               # API client
│   │   ├── components/        # React components
│   │   │   ├── AuthPage.jsx   # Login/Signup
│   │   │   ├── chat/          # Chat UI components
│   │   │   ├── sidebar/       # Sidebar components
│   │   │   └── ...
│   │   ├── pages/             # Page components
│   │   ├── context/           # React Context (Auth, Socket, Theme)
│   │   ├── hooks/             # Custom hooks
│   │   └── utils/             # Utilities
│   └── .env.example           # Environment template
│
├── backend/                    # Express.js backend
│   ├── src/
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.js
│   │   │   ├── admin.js
│   │   │   └── errorHandler.js
│   │   ├── routes/            # API routes
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── chats.js
│   │   │   ├── messages.js
│   │   │   └── admin.js
│   │   ├── models/            # Data models
│   │   ├── services/          # Business logic
│   │   ├── utils/             # Utilities
│   │   ├── db.js             # MongoDB connection
│   │   ├── socket.js         # Socket.IO setup
│   │   └── server.js         # Express app
│   ├── scripts/              # Database scripts
│   ├── package.json
│   └── .env.example
│
├── DEPLOYMENT_GUIDE.md       # Detailed deployment steps
├── PRODUCTION_CONFIG.md      # Quick production reference
├── .env.example              # Root environment template
└── README.md                 # This file
```

## 🔐 API Endpoints

All endpoints:
- **Development:** `http://localhost:5000/api`
- **Production:** `https://ana-chat.onrender.com/api`

### Authentication
- `POST /auth/signup` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/google` - Google OAuth login
- `POST /auth/logout` - Logout user
- `POST /auth/refresh` - Refresh access token

### Users
- `GET /users` - Get user list
- `GET /users/:id` - Get user profile
- `PUT /users/profile` - Update profile
- `POST /users/block/:id` - Block user
- `DELETE /users/block/:id` - Unblock user

### Chats  
- `GET /chats` - Get user's chats
- `POST /chats` - Create new chat
- `PUT /chats/:id` - Update chat
- `DELETE /chats/:id` - Delete chat

### Messages
- `GET /chats/:chatId/messages` - Get chat messages
- `POST /chats/:chatId/messages` - Send message
- `PUT /messages/:id` - Edit message
- `DELETE /messages/:id` - Delete message

### Admin
- `GET /admin/users` - List all users
- `GET /admin/chats` - List all chats
- `GET /admin/audit-logs` - View audit logs

## 🐛 Troubleshooting

### Issue: 404 POST /api/auth/login

**Problem:** Frontend trying to call itself instead of backend.

**Solution:**
1. Check `VITE_API_URL` environment variable
2. Should be backend URL: `https://ana-chat.onrender.com/api`
3. Rebuilt frontend: `npm run build`
4. Verify backend is accessible

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#issue-1-404-post-apiauthlogin) for details.

### Issue: CORS Errors

**Problem:** Backend rejecting requests from frontend

**Solution:**
1. Update `CLIENT_ORIGIN` in backend `.env`
2. Must include frontend domain
3. Restart backend

### Issue: Socket Connection Failed

**Problem:** Real-time features not working

**Solution:**
1. Check `VITE_SOCKET_URL` environment variable
2. Must match backend URL
3. Ensure backend Socket.IO is running

## 🚀 Deployment

### Quick Deploy

1. **Backend on Render:**
   - Connect GitHub repo
   - Add environment variables
   - Backend auto-deploys on git push
   - Access at: `https://ana-chat.onrender.com`

2. **Frontend on Vercel:**
   - Connect GitHub repo
   - Set root directory: `frontend`
   - Add environment variables
   - Frontend auto-deploys on git push
   - Access at: `https://chat.myana.site`

3. **Database:**
   - Use MongoDB Atlas (free tier available)
   - Get connection string
   - Add to backend environment variables

### For Complete Setup Guide

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for step-by-step production deployment.

## 💾 Database

**MongoDB Collections:**
- `users` - User accounts and profiles
- `chats` - Chat rooms/conversations
- `messages` - Message content and metadata
- `admin` - Admin panel users
- `audit_logs` - Admin action audit trail

**Indexes:** Auto-indexed on common queries (userId, chatId, createdAt)

## 🔐 Security Features

- ✅ JWT authentication with httpOnly cookies
- ✅ Refresh token rotation
- ✅ Session management
- ✅ CORS protection
- ✅ Admin audit logging
- ✅ User blocking (prevents access)
- ✅ Secure password hashing (bcrypt)
- ✅ Google OAuth 2.0 integration
- ✅ WebSocket authentication
- ✅ Rate limiting on auth endpoints

## 📊 Admin Panel

Access at `/admin` after login (requires admin role)

**Features:**
- User management
- Chat monitoring
- Message history
- Block/unblock users
- View audit logs
- System statistics

## 🛠️ Available Scripts

**Frontend:**
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

**Backend:**
```bash
npm run dev      # Start dev server with nodemon
npm start        # Start production server
npm run db:init  # Initialize database
npm run db:migrate # Run migrations
npm run db:seed  # Seed demo data
```

## 📞 Support

For issues or questions:
1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#troubleshooting)
2. Review browser console logs (F12)
3. Check backend logs (Render dashboard)
4. Verify environment variables set correctly

## 📄 License

This project is part of AnaChat platform.

---

**Production URLs:**
- Frontend: https://chat.myana.site
- Backend API: https://ana-chat.onrender.com/api
- Health Check: https://ana-chat.onrender.com/status

