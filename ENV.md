# Environment Variables Configuration Guide

This document explains all environment variables required for AnaChat backend and frontend.

---

## Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

### Database Configuration
```
MONGODB_URI=mongodb://localhost:27017/anachatte
```
- MongoDB connection string
- For local development: `mongodb://localhost:27017/anachatte`
- For Atlas/Cloud: `mongodb+srv://username:password@cluster.mongodb.net/anachatte`

### Server Configuration
```
PORT=5000
NODE_ENV=production
```
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: `development` or `production`

### CORS and Frontend Origin
```
CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site
```
- Comma-separated list of allowed frontend origins
- Examples:
  - Local dev: `http://localhost:5173,http://localhost:5174`
  - Production: `https://chat.myana.site,https://www.chat.myana.site`
  - Render + Vercel: `https://api.chat.myana.site,https://your-frontend-domain.vercel.app`

### Google OAuth Configuration
```
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_IDS=your_google_client_id.apps.googleusercontent.com
```
- Get from [Google Cloud Console](https://console.cloud.google.com/)
- Required for Google sign-in feature

### JWT and Session Secrets
```
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
SESSION_SECRET=your_session_secret_key_change_this_in_production
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key_change_this_in_production
```
- Use strong random strings
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### SMS Configuration (Optional)
```
FAST2SMS_API_KEY=your_fast2sms_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```
- For SMS OTP/notifications (optional feature)
- Get from Fast2SMS or Twilio dashboard

### Redis Configuration (Optional)
```
REDIS_URL=redis://localhost:6379
```
- For distributed socket.io sessions
- Optional: removes Redis adapter if not set

### Secure Cookies
```
FORCE_SECURE_COOKIES=true
```
- Set to `true` in production (requires HTTPS)
- Set to `false` for local HTTP development

### Example .env for Local Development
```env
MONGODB_URI=mongodb://localhost:27017/anachatte
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174
GOOGLE_CLIENT_ID=your_test_google_client_id
JWT_SECRET=dev_secret_key_not_for_production
SESSION_SECRET=dev_session_secret
REFRESH_TOKEN_SECRET=dev_refresh_secret
FORCE_SECURE_COOKIES=false
```

### Example .env for Production (Render)
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/anachatte
PORT=5000
NODE_ENV=production
CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_IDS=your_production_google_client_id
JWT_SECRET=generate_random_secure_string_here
SESSION_SECRET=generate_random_secure_string_here
REFRESH_TOKEN_SECRET=generate_random_secure_string_here
FORCE_SECURE_COOKIES=true
REDIS_URL=redis://your-redis-url:6379
```

---

## Frontend Environment Variables

Create a `.env` file in the `frontend/` directory with the following variables:

### API Configuration
```
VITE_API_URL=https://api.chat.myana.site/api
```
- Backend API endpoint
- Examples:
  - Local dev: `http://localhost:5000/api`
  - Production Render: `https://api.chat.myana.site/api`
  - Custom domain: `https://api.yourdomain.com/api`

### WebSocket Configuration
```
VITE_SOCKET_URL=https://api.chat.myana.site
```
- Socket.IO server endpoint (without `/api` path)
- Examples:
  - Local dev: `http://localhost:5000`
  - Production Render: `https://api.chat.myana.site`
  - Custom domain: `https://api.yourdomain.com`

### Google OAuth Configuration
```
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```
- Same as backend `GOOGLE_CLIENT_ID`
- Must match the origin domain configured in Google Cloud Console

### Security Settings
```
VITE_DISABLE_DEVTOOLS=true
```
- Set to `true` in production to disable dev tools
- Set to `false` in development for debugging

### Example .env for Local Development
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_test_google_client_id
VITE_DISABLE_DEVTOOLS=false
```

### Example .env for Production (Vercel)
```env
VITE_API_URL=https://api.chat.myana.site/api
VITE_SOCKET_URL=https://api.chat.myana.site
VITE_GOOGLE_CLIENT_ID=your_production_google_client_id
VITE_DISABLE_DEVTOOLS=true
```

### Example .env for Custom Domain
```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_SOCKET_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=your_custom_domain_google_client_id
VITE_DISABLE_DEVTOOLS=true
```

---

## Environment Variables Quick Reference

| Variable | Backend | Frontend | Required | Example |
|----------|---------|----------|----------|---------|
| `MONGODB_URI` | ✅ | ❌ | Yes | `mongodb://localhost:27017/anachatte` |
| `PORT` | ✅ | ❌ | No | `5000` |
| `NODE_ENV` | ✅ | ❌ | Yes | `production` |
| `CLIENT_ORIGIN` | ✅ | ❌ | Yes | `https://chat.myana.site,https://www.chat.myana.site` |
| `GOOGLE_CLIENT_ID` | ✅ | ❌ | No | `xxx.apps.googleusercontent.com` |
| `JWT_SECRET` | ✅ | ❌ | Yes | (random string) |
| `SESSION_SECRET` | ✅ | ❌ | Yes | (random string) |
| `REFRESH_TOKEN_SECRET` | ✅ | ❌ | Yes | (random string) |
| `FORCE_SECURE_COOKIES` | ✅ | ❌ | No | `true` |
| `REDIS_URL` | ✅ | ❌ | No | `redis://localhost:6379` |
| `VITE_API_URL` | ❌ | ✅ | No* | `https://api.chat.myana.site/api` |
| `VITE_SOCKET_URL` | ❌ | ✅ | No* | `https://api.chat.myana.site` |
| `VITE_GOOGLE_CLIENT_ID` | ❌ | ✅ | No | `xxx.apps.googleusercontent.com` |
| `VITE_DISABLE_DEVTOOLS` | ❌ | ✅ | No | `true` |

*Frontend will auto-detect and use fallback if not set in production

---

## How to Generate Secure Secret Keys

Run this command in Node.js to generate a random secure key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use different values for each secret variable.

---

## Deployment Checklist

### Before Deploying to Production:

- [ ] Backend and Frontend `.env` files created and filled
- [ ] `NODE_ENV=production` set in backend
- [ ] `FORCE_SECURE_COOKIES=true` set in backend (if using HTTPS)
- [ ] `VITE_DISABLE_DEVTOOLS=true` set in frontend
- [ ] All JWT/Session secrets are strong random strings
- [ ] `CLIENT_ORIGIN` includes all frontend domains
- [ ] `VITE_API_URL` and `VITE_SOCKET_URL` point to correct backend
- [ ] MongoDB connection is working
- [ ] Google OAuth credentials are valid and configured
- [ ] Verify CORS by testing API calls from frontend

---

## Troubleshooting

### API Requests Fail (ERR_INSUFFICIENT_RESOURCES)
- Check `VITE_API_URL` is set correctly in frontend `.env`
- Check `CLIENT_ORIGIN` includes frontend domain in backend `.env`
- Verify backend is running and responding

### Socket Connection Fails
- Check `VITE_SOCKET_URL` matches backend in frontend `.env`
- Check `CLIENT_ORIGIN` in backend `.env` includes frontend origin
- Verify WebSocket connections are allowed in firewall/proxy

### Google Login Doesn't Work
- Check `VITE_GOOGLE_CLIENT_ID` in frontend matches backend `GOOGLE_CLIENT_ID`
- Verify OAuth app is configured for correct domain in Google Cloud Console
- Check localhost is added to authorized origins for local development

### Database Connection Error
- Verify `MONGODB_URI` is correct and MongoDB is running
- For Atlas: check IP whitelist and connection string format
- Check credentials in connection string

---

## Environment Variable Validation

The application validates critical variables on startup:
- Backend requires: `MONGODB_URI`, `JWT_SECRET`, `SESSION_SECRET`, `REFRESH_TOKEN_SECRET`, `CLIENT_ORIGIN`
- Frontend requires: `VITE_API_URL` (or auto-detected in production)

If validation fails, the application will log errors and fail to start.
