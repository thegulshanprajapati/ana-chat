# AnaChat Deployment Guide

Complete guide to deploy AnaChat with MongoDB database, backend on Render, and frontend on Vercel.

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Database Setup (MongoDB)](#database-setup-mongodb)
3. [Backend Deployment (Render)](#backend-deployment-render)
4. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
5. [Production Configuration](#production-configuration)
6. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites
- Node.js (v16+)
- npm or yarn
- MongoDB (local or Atlas)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ankit
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies (if any)
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   cd ..
   
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

3. **Setup environment variables**
   
   **Backend** - Create `backend/.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/anachat
   NODE_ENV=development
   PORT=5000
   CLIENT_ORIGIN=http://localhost:5173,http://localhost:3000
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_IDS=your_google_client_id
   JWT_SECRET=dev_jwt_secret_change_in_production
   JWT_REFRESH_SECRET=dev_jwt_refresh_secret_change_in_production
   FAST2SMS_API_KEY=your_sms_api_key_if_needed
   ```
   
   **Frontend** - Create `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   VITE_DISABLE_DEVTOOLS=false
   ```

4. **Start MongoDB locally** (if not using Atlas)
   ```bash
   mongod
   ```

5. **Start the development servers**
   
   Terminal 1 - Backend:
   ```bash
   cd backend
   npm run dev
   ```
   
   Terminal 2 - Frontend:
   ```bash
   cd frontend
   npm run dev
   ```

   Your app will be available at `http://localhost:5173`

---

## Database Setup (MongoDB)

### Option 1: Local MongoDB
1. Install MongoDB Community Edition from https://www.mongodb.com/try/download/community
2. Start MongoDB service
3. Connect using `mongodb://localhost:27017/anachat`

### Option 2: MongoDB Atlas (Cloud - Recommended for Production)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Create a database user with read/write permissions
4. Get connection string (will look like):
   ```
   mongodb+srv://username:password@cluster.mongodb.net/anachat?retryWrites=true&w=majority
   ```
5. Add your IP to network access list

**Database Collections** (automatically created):
- `users` - User accounts and profiles
- `chats` - Chat rooms and conversations
- `messages` - Message content and metadata
- `admin` - Admin panel users and settings

---

## Backend Deployment (Render)

### Step 1: Prepare Backend for Deployment

1. **Ensure `backend/.env` is NOT committed to git**
   - Check `.gitignore` includes `backend/.env`

2. **Create MongoDB Atlas account and database**
   - Get your MongoDB connection URI (see Database Setup section)

### Step 2: Deploy on Render

1. **Go to https://render.com**
2. **Sign up/Login** with GitHub
3. **Create New Web Service**
   - Select your GitHub repository
   - Build command: `npm install && cd backend && npm install`
   - Start command: `cd backend && npm start`
   - Environment: Node
   - Instance Type: Free tier is fine for testing

4. **Add Environment Variables** (in Render Dashboard)
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/anachat?retryWrites=true&w=majority
   NODE_ENV=production
   PORT=5000
   CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_IDS=your_google_client_id
   JWT_SECRET=generate_random_secret_here
   JWT_REFRESH_SECRET=generate_random_secret_here
   FAST2SMS_API_KEY=your_sms_api_key_if_needed
   ```

5. **Deploy**
   - Render will automatically deploy when you push to your main branch
   - Your backend URL will be: `https://ana-chat.onrender.com` (example)
   - Health check: `https://ana-chat.onrender.com/status`

---

## Frontend Deployment (Vercel)

### Step 1: Setup Environment Variables

**Important:** The frontend needs to know the backend URL at build time.

1. **Update `frontend/.env.production`** or configure in Vercel:
   ```
   VITE_API_URL=https://ana-chat.onrender.com/api
   VITE_SOCKET_URL=https://ana-chat.onrender.com
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   VITE_DISABLE_DEVTOOLS=true
   ```

### Step 2: Deploy on Vercel

1. **Go to https://vercel.com**
2. **Sign up/Login** with GitHub
3. **Import Project**
   - Select your GitHub repository
   - Framework: Vite
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`

4. **Add Environment Variables**
   ```
   VITE_API_URL=https://ana-chat.onrender.com/api
   VITE_SOCKET_URL=https://ana-chat.onrender.com
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   VITE_DISABLE_DEVTOOLS=true
   ```

5. **Configure Custom Domain**
   - Add domain: `chat.myana.site`
   - Update DNS records in your domain provider
   - Vercel provides DNS instructions

6. **Deploy**
   - Vercel will auto-deploy on git push
   - Your frontend will be at: `https://chat.myana.site`

---

## Production Configuration

### Backend Production (.env in `backend/`)

```env
# Database - Use MongoDB Atlas in production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/anachat?retryWrites=true&w=majority

# Node Environment
NODE_ENV=production

# Server
PORT=5000

# Frontend Origins for CORS
CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site

# Google OAuth
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_IDS=your_production_google_client_id

# JWT Secrets - Generate random strings!
# Command: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<your_random_32_char_hex_string>
JWT_REFRESH_SECRET=<your_random_32_char_hex_string>

# SMS Provider
FAST2SMS_API_KEY=your_api_key

# Security
FORCE_SECURE_COOKIES=true
```

### Frontend Production (.env in `frontend/`)

```env
VITE_API_URL=https://ana-chat.onrender.com/api
VITE_SOCKET_URL=https://ana-chat.onrender.com
VITE_GOOGLE_CLIENT_ID=your_production_google_client_id
VITE_DISABLE_DEVTOOLS=true
```

---

## Fixing Common Issues

### Issue 1: 404 POST https://chat.myana.site/api/auth/login

**Problem:** Frontend making requests to itself instead of backend.

**Solution:** 
1. Ensure `VITE_API_URL` is set correctly in frontend environment:
   ```
   VITE_API_URL=https://ana-chat.onrender.com/api
   ```
2. Rebuild frontend: `npm run build`
3. Redeploy on Vercel

**Debug Steps:**
- Check browser DevTools → Network → see request URL
- Check browser console: `console.log(window.location.href)` shows frontend URL
- Frontend should send requests to `https://ana-chat.onrender.com/api`, NOT `https://chat.myana.site/api`

### Issue 2: CORS Errors

**Problem:** Access to XMLHttpRequest ... CORS policy

**Solution:**
1. Backend must list frontend origin in `CLIENT_ORIGIN`:
   ```env
   CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site
   ```
2. Restart backend
3. Wait for Render to redeploy (auto-deploys on env var change)

### Issue 3: Login/Signup Form Not Working

**Problem:** Form submits but nothing happens.

**Checklist:**
- [ ] Backend API endpoint exists: `POST /api/auth/login`
- [ ] `VITE_API_URL` environment variable is set in frontend
- [ ] Backend is running and accessible
- [ ] Check browser console for error messages
- [ ] Check backend logs for errors

### Issue 4: Socket Connection Failed

**Problem:** Real-time features not working

**Solution:**
- Ensure `VITE_SOCKET_URL` matches backend URL:
  ```
  VITE_SOCKET_URL=https://ana-chat.onrender.com
  ```
- Socket.IO must be running on backend
- Check CORS allows WebSocket upgrades

---

## Deployment Checklist

### Before Production
- [ ] Generate random secrets for JWT
- [ ] Setup MongoDB Atlas database
- [ ] Create Google OAuth credentials
- [ ] Configure SMS API key (if using)
- [ ] Update all environment variables
- [ ] Test login/signup locally
- [ ] Verify database backups enabled

### Frontend (Vercel)
- [ ] Environment variables set correctly
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Custom domain configured
- [ ] Auto-deploy from main branch enabled

### Backend (Render)
- [ ] All environment variables set
- [ ] MongoDB URI working
- [ ] Build command: `npm install && cd backend && npm install`
- [ ] Start command: `cd backend && npm start`
- [ ] Health check URL: `/status`
- [ ] Auto-deploys on push to main

### Testing After Deployment
- [ ] Visit https://chat.myana.site
- [ ] Try signup with email/mobile
- [ ] Try login
- [ ] Send messages (real-time)
- [ ] Check console for errors
- [ ] Verify no 404 errors

---

## Monitoring & Maintenance

### Useful Links
- **Render Dashboard:** https://dashboard.render.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **MongoDB Atlas:** https://cloud.mongodb.com
- **Google Cloud Console:** https://console.cloud.google.com

### Logs
- **Vercel Logs:** Vercel Dashboard → Deployments → View Build Logs
- **Render Logs:** Render Dashboard → Services → Backend → Logs
- **Browser Console:** Press F12 → Console tab
- **Backend Logs:** Check stdout/stderr in Render dashboard

### SSL Certificate
- Vercel: Auto-managed by Vercel
- Render: Auto-managed by Render
- Both use Let's Encrypt for free SSL

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login with email/mobile
- `POST /api/auth/google` - Google OAuth signup/login
- `POST /api/auth/logout` - Logout user

### Base URL for all endpoints
- **Production:** `https://ana-chat.onrender.com/api`
- **Development:** `http://localhost:5000/api`

---

## Need Help?

1. Check the logs in Render/Vercel dashboards
2. Look at browser Console (F12)
3. Verify all environment variables are set
4. Check that backend is responding: `curl https://ana-chat.onrender.com/status`
5. Ensure MongoDB is accessible from backend

---

**Last Updated:** May 2026
