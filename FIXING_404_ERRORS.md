# Fixing 404 Errors on Production

Quick guide to fix the `404 POST https://chat.myana.site/api/auth/login` error.

## The Problem

Your frontend is making requests to itself instead of your backend:

```
❌ POST https://chat.myana.site/api/auth/login 404 (Not Found)
   └─ Should be: https://ana-chat.onrender.com/api/auth/login
```

This happens when `VITE_API_URL` environment variable is not set correctly during the build.

## The Solution (3 Steps)

### Step 1: Set Frontend Environment Variable

Create `frontend/.env.production` or add to Vercel Dashboard:

```env
VITE_API_URL=https://ana-chat.onrender.com/api
VITE_SOCKET_URL=https://ana-chat.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_DISABLE_DEVTOOLS=true
```

**Do NOT use:**
- ❌ `http://` (Vercel uses HTTPS)
- ❌ `https://chat.myana.site/api` (that's the frontend, not backend)
- ❌ Just `/api` (won't work in production on different domain)

### Step 2: Rebuild Frontend

Rebuild the frontend so `VITE_API_URL` gets baked into the build:

```bash
cd frontend
npm run build
```

The build process reads the environment variable and hardcodes it into the JavaScript.

### Step 3: Redeploy on Vercel

Push to your repository and Vercel will auto-redeploy:

```bash
git add .
git commit -m "Fix API URL for production"
git push origin main
```

Or manually trigger deploy in Vercel dashboard.

## Verification

After redeployment, test in browser console:

```javascript
// In browser DevTools Console (F12)
// This should show your backend URL, NOT your frontend URL

// For React Vite:
console.log(import.meta.env.VITE_API_URL)

// Output should be:
// https://ana-chat.onrender.com/api  ✅ CORRECT
// NOT:
// https://chat.myana.site/api        ❌ WRONG
// NOT:
// /api                               ❌ WRONG
```

## Network Tab Check

1. Open DevTools → Network tab (F12)
2. Try to login
3. Look for the POST request
4. Check the URL in the request

```
✅ CORRECT:  POST https://ana-chat.onrender.com/api/auth/login
❌ WRONG:    POST https://chat.myana.site/api/auth/login
❌ WRONG:    POST /api/auth/login
```

## Troubleshooting Checklist

- [ ] `VITE_API_URL` set in Vercel environment variables
- [ ] Value is `https://ana-chat.onrender.com/api` (with `/api` at end)
- [ ] Frontend rebuilt: `npm run build`
- [ ] Changes pushed to GitHub
- [ ] Vercel redeploy completed (check Deployments)
- [ ] Browser cache cleared (Ctrl+Shift+Delete)
- [ ] Backend is running (test with curl https://ana-chat.onrender.com/status)

## If Still Not Working

1. **Check Backend is Actually Running:**
   ```bash
   curl https://ana-chat.onrender.com/status
   ```
   Should return HTML status page (not 404)

2. **Check CORS Configuration:**
   Backend `CLIENT_ORIGIN` should include your frontend domain:
   ```env
   CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site
   ```

3. **Check Auth Routes Exist:**
   Should see routes defined in `backend/src/routes/auth.js`:
   - `POST /auth/login`
   - `POST /auth/signup`
   - `POST /auth/google`

4. **Clear All Caches:**
   - Browser cache: Ctrl+Shift+Delete
   - Hard refresh: Ctrl+F5
   - CloudFlare cache (if using)
   - AWS CloudFront cache (if using)

## Example Working Setup

**Frontend** - `https://chat.myana.site` (Vercel)
```env
# What Vercel sees after build:
VITE_API_URL=https://ana-chat.onrender.com/api
VITE_SOCKET_URL=https://ana-chat.onrender.com
```

**Backend** - `https://ana-chat.onrender.com` (Render)
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site
```

**Flow:**
1. User visits `https://chat.myana.site`
2. Frontend JS (includes `VITE_API_URL=https://ana-chat.onrender.com/api`)
3. User clicks Login
4. Frontend sends: `POST https://ana-chat.onrender.com/api/auth/login`
5. Backend receives and authenticates
6. Backend sends response back to frontend
7. Frontend receives and logs user in ✅

## Quick Reference

| Variable | Should Be | NOT |
|----------|-----------|-----|
| VITE_API_URL | `https://ana-chat.onrender.com/api` | `/api` or `https://chat.myana.site/api` |
| VITE_SOCKET_URL | `https://ana-chat.onrender.com` | `http://` or `https://chat.myana.site` |
| CLIENT_ORIGIN (backend) | `https://chat.myana.site` | `https://ana-chat.onrender.com` |

---

**Still stuck?** See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#troubleshooting) for more detailed troubleshooting.
