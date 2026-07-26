# AnaChat Production URLs & API Configuration

Quick reference for your production setup.

## Your Production URLs

```
Frontend URL:     https://chat.myana.site
Backend URL:      https://ana-chat.onrender.com
API Base URL:     https://ana-chat.onrender.com/api
Socket URL:       https://ana-chat.onrender.com
Database:         MongoDB Atlas
```

## Environment Variables Summary

### Frontend (.env in `frontend/` folder)
```env
VITE_API_URL=https://ana-chat.onrender.com/api
VITE_SOCKET_URL=https://ana-chat.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_DISABLE_DEVTOOLS=true
```

### Backend (.env in `backend/` folder)
```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/anachat?retryWrites=true&w=majority

# Server
NODE_ENV=production
PORT=5000

# Frontend CORS
CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_IDS=your_google_client_id

# Generate these with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_random_secret_here
JWT_REFRESH_SECRET=your_random_secret_here

# Security
FORCE_SECURE_COOKIES=true
SUPER_ADMIN=8709131702
```

## Deployment Flow

### Step 1: Backend Setup (Render)
1. Push code to GitHub
2. Go to https://dashboard.render.com
3. Create new Web Service
4. Connect GitHub repo
5. Add all environment variables from Backend section above
6. Backend will be live at: `https://ana-chat.onrender.com`

### Step 2: Frontend Setup (Vercel)
1. Push code to GitHub
2. Go to https://vercel.com
3. Import project
4. Set root directory to: `frontend`
5. Add environment variables from Frontend section above
6. Add custom domain: `chat.myana.site`
7. Frontend will be live at: `https://chat.myana.site`

## API Endpoints

All endpoints start with: `https://ana-chat.onrender.com/api`

### Auth Endpoints
- `POST /auth/signup` - Create account
- `POST /auth/login` - Login
- `POST /auth/google` - Google OAuth
- `POST /auth/logout` - Logout

### Example API Call (from frontend)
```javascript
// This works because VITE_API_URL=https://ana-chat.onrender.com/api
fetch('https://ana-chat.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email_or_mobile: 'user@example.com',
    password: 'password123'
  })
})
```

## Health Check

Test your backend is running:
```bash
curl https://ana-chat.onrender.com/status
```

Should return 200 OK status.

## Database Collections

MongoDB will have these collections:
- `users` - User accounts
- `chats` - Chat conversations
- `messages` - Messages
- `admin` - Admin users

## Troubleshooting 404 Errors

**Problem:** `POST https://chat.myana.site/api/auth/login 404 (Not Found)`

**Fix:** Frontend is trying to call itself instead of backend.

**Check:**
1. ✓ `VITE_API_URL` is set to `https://ana-chat.onrender.com/api` (NOT `https://chat.myana.site`)
2. ✓ Frontend rebuilt after environment update: `npm run build`
3. ✓ Frontend redeployed on Vercel
4. ✓ Backend is running: `curl https://ana-chat.onrender.com/status`
5. ✓ Backend has auth routes: check `backend/src/routes/auth.js` exists

**Browser Console:**
```javascript
// Run this in browser to verify:
console.log(import.meta.env.VITE_API_URL)
// Should show: https://ana-chat.onrender.com/api
```

## CORS Configuration

Backend CORS is configured to allow:
- `https://chat.myana.site`
- `https://www.chat.myana.site`

If you use different domain, update `CLIENT_ORIGIN` in backend `.env`.

## Common Mistakes

❌ Frontend `.env` shows `VITE_API_URL=/api` → Won't work in production
✅ Frontend `.env` shows `VITE_API_URL=https://ana-chat.onrender.com/api` → Correct

❌ Backend `CLIENT_ORIGIN` doesn't include frontend domain → CORS error
✅ Backend `CLIENT_ORIGIN=https://chat.myana.site` → Correct

❌ `JWT_SECRET` is same across environments → Security issue
✅ Generate unique secrets for each environment → Secure

---

**For detailed deployment steps, see:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
