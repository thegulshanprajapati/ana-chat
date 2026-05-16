# Quick Start Guide for Production Deployment

Follow these steps in order to get your chat app production-ready on Render (backend) and Vercel (frontend).

## 📋 Pre-Deployment Checklist

- [ ] GitHub account with your repository
- [ ] MongoDB Atlas account and database created
- [ ] Google OAuth Client ID (from Google Cloud Console)
- [ ] Render account (render.com)
- [ ] Vercel account (vercel.com)
- [ ] Domain registered (chat.myana.site)
- [ ] DNS access to update records

---

## 🔧 Step 1: Setup MongoDB Database

**Time: 10 minutes**

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account or login
3. Create new project (name: `anachat`)
4. Create free cluster
5. Create database user:
   - Username: `anachat`
   - Password: Generate strong password
   - Click "Create User"
6. Add your IP:
   - Security → Network Access → Add IP
   - Add 0.0.0.0/0 (allows all IPs for production)
7. Get connection string:
   - Databases → Connect → Drivers
   - Copy MongoDB connection string
   - Should look like: `mongodb+srv://anachat:PASSWORD@cluster.mongodb.net/anachat?retryWrites=true&w=majority`
8. Replace PASSWORD with your password

**Save this connection string!** You'll need it in Step 3.

---

## 🔐 Step 2: Generate Production Secrets

**Time: 2 minutes**

Generate random secrets for JWT tokens:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy and save these values. You'll need them in Step 3.

---

## 🚀 Step 3: Deploy Backend on Render

**Time: 15 minutes**

1. Go to https://dashboard.render.com
2. Sign up with GitHub
3. Click "New Web Service"
4. Select your GitHub repository
5. Fill in settings:
   - **Name:** `ana-chat` (or your choice)
   - **Build Command:** `npm install && cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
   - **Environment:** Node
   - **Instance Type:** Free (or paid if needed)
6. Click "Create Web Service"
7. Wait for initial deployment (2-3 minutes)

### Add Environment Variables to Render

Once deployed, go to your service dashboard:

1. Click "Environment"
2. Add these variables (one by one):

```
MONGODB_URI = mongodb+srv://anachat:PASSWORD@cluster.mongodb.net/anachat?retryWrites=true&w=majority
```
(Replace PASSWORD with your MongoDB password)

```
NODE_ENV = production
GOOGLE_CLIENT_ID = your_google_client_id
GOOGLE_CLIENT_IDS = your_google_client_id
JWT_SECRET = (from Step 2)
JWT_REFRESH_SECRET = (from Step 2)
CLIENT_ORIGIN = https://chat.myana.site,https://www.chat.myana.site
FORCE_SECURE_COOKIES = true
```

3. Click "Save" after each variable

Render will auto-redeploy when environment variables change.

### Verify Backend is Working

1. Wait for deployment to complete
2. Find your backend URL in Render dashboard (should be something like `https://ana-chat.onrender.com`)
3. Test it: `https://ana-chat.onrender.com/status`
4. Should see AnaChat status page (not 404)

**Save your backend URL!** You'll need it in Step 4.

---

## 🎨 Step 4: Deploy Frontend on Vercel

**Time: 15 minutes**

1. Go to https://vercel.com/dashboard
2. Sign up with GitHub if needed
3. Click "Add New..." → "Project"
4. Select your GitHub repository
5. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Add Environment Variables to Vercel

Before deploying:

1. Find "Environment Variables" section
2. Add these variables:

```
VITE_API_URL = https://ana-chat.onrender.com/api
```
(Replace with your actual Render backend URL + `/api`)

```
VITE_SOCKET_URL = https://ana-chat.onrender.com
```
(Replace with your actual Render backend URL, no `/api`)

```
VITE_GOOGLE_CLIENT_ID = your_google_client_id
VITE_DISABLE_DEVTOOLS = true
```

3. Click "Deploy"

### Setup Custom Domain

1. After deployment completes:
2. Go to "Settings" → "Domains"
3. Click "Add Domain"
4. Enter: `chat.myana.site`
5. Choose "Using external nameservers"
6. Update your domain's DNS records as instructed
7. Wait 5-10 minutes for DNS to propagate

### Verify Frontend is Working

1. Visit `https://chat.myana.site`
2. Should see login/signup page
3. Try signing up (should work if backend is running)

---

## ✅ Step 5: Verify Everything Works

**Time: 5 minutes**

### Test Signup

1. Go to https://chat.myana.site
2. Click "Sign Up"
3. Enter:
   - Name: Test User
   - Email: test@example.com
   - Mobile: 1234567890
   - Password: Password123
4. Click "Join AnaChat"
5. Should see chat interface (not error)

### Test Login

1. Click "Login" tab
2. Enter credentials
3. Click "Login to AnaChat"
4. Should see chat interface

### Troubleshooting

If signup/login fails, check:

```javascript
// In browser console (F12):
console.log(import.meta.env.VITE_API_URL)
// Should show: https://ana-chat.onrender.com/api
```

If not showing backend URL:
1. Check Vercel environment variables again
2. You may need to redeploy (triggering a new build)

See [FIXING_404_ERRORS.md](./FIXING_404_ERRORS.md) if you get 404 errors.

---

## 🎉 Deployment Complete!

Your chat app is now live!

```
Frontend:  https://chat.myana.site
Backend:   https://ana-chat.onrender.com
Database:  MongoDB Atlas
```

### Keep These URLs Handy

- **Render Dashboard:** https://dashboard.render.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **MongoDB Atlas:** https://cloud.mongodb.com

### What's Next?

- Add more Google Client IDs if needed
- Configure SMS provider (fast2sms) if using OTP
- Monitor logs in Render/Vercel dashboards
- Setup auto-backups for MongoDB
- Create admin account for management

---

## 📚 Documentation

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Detailed deployment steps
- [PRODUCTION_CONFIG.md](./PRODUCTION_CONFIG.md) - Production URL reference
- [FIXING_404_ERRORS.md](./FIXING_404_ERRORS.md) - Fix common errors
- [README.md](./README.md) - Full project documentation

---

## 🆘 Common Issues

### 404 Error on Login

See [FIXING_404_ERRORS.md](./FIXING_404_ERRORS.md)

**Quick fix:** Check `VITE_API_URL` environment variable is set to your backend URL.

### CORS Error

Backend not allowing your frontend domain.

**Fix:** Add to Render environment variables:
```
CLIENT_ORIGIN=https://chat.myana.site
```

### Socket Not Connecting

Real-time chat not working.

**Fix:** Check `VITE_SOCKET_URL` environment variable matches backend URL.

### Database Connection Error

Backend can't reach MongoDB.

**Fix:** Check `MONGODB_URI` in Render environment variables. Test connection string in MongoDB Atlas.

---

## 📞 Need Help?

1. Check the docs above
2. Review [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#troubleshooting)
3. Check console logs (F12)
4. Check Render/Vercel logs
5. Test: `curl https://ana-chat.onrender.com/status`

---

**Estimated Total Time: 45 minutes**

You're all set! 🚀
