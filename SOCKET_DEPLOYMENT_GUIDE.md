# Socket.IO Production Deployment Guide

## ===== DEPLOYMENT STEPS =====

### Step 1: Deploy Backend Changes

```bash
# 1. SSH into your VPS
ssh user@your-vps-ip

# 2. Navigate to backend
cd /path/to/ana-chat/backend

# 3. Backup current server.js and socket.js
cp src/server.js src/server.js.backup
cp src/socket.js src/socket.js.backup

# 4. Pull latest code or manually update files
git pull origin main
# OR manually copy the updated server.js and socket.js

# 5. Install any new dependencies (if any)
npm install

# 6. Verify code syntax
node --check src/server.js
node --check src/socket.js

# 7. Test in development mode first (if possible)
NODE_ENV=development npm start
# Check for: "[Socket.IO] ✓ Initialized successfully"

# Press Ctrl+C to stop

# 8. Rebuild if using TypeScript/build process
npm run build

# 9. Reload with PM2
pm2 reload ana-chat-backend

# 10. Monitor logs
pm2 logs ana-chat-backend
```

### Step 2: Deploy Frontend Changes

```bash
# 1. Navigate to frontend
cd /path/to/ana-chat/frontend

# 2. Backup current context files
cp src/context/SocketContext.jsx src/context/SocketContext.jsx.backup
cp src/utils/ src/utils.backup/

# 3. Pull latest code
git pull origin main

# 4. Copy new socket files
# - src/utils/socket.js (new singleton)
# - src/context/SocketContextNew.jsx (new provider)

# 5. Update imports in App.jsx to use NEW SocketProvider:
# Change from: import { SocketProvider } from "./context/SocketContext";
# To: import { SocketProvider } from "./context/SocketContextNew";

# 6. Build frontend
npm run build

# 7. Deploy to frontend server (Vercel, nginx, etc.)
# If using Vercel: vercel --prod
# If using nginx: cp -r dist/* /var/www/chat-frontend/dist/

# Verify build succeeded
ls -la dist/
```

### Step 3: Update NGINX Configuration

```bash
# 1. Backup current NGINX config
sudo cp /etc/nginx/sites-available/api.chat.myana.site /etc/nginx/sites-available/api.chat.myana.site.backup

# 2. Copy new production config
sudo cp /path/to/ana-chat/nginx-production.conf /etc/nginx/sites-available/api.chat.myana.site

# 3. Update SSL certificate paths in NGINX config
# Edit: /etc/nginx/sites-available/api.chat.myana.site
# Find: ssl_certificate /path/to/ssl/...
# Change to your actual cert paths

# 4. Test NGINX configuration
sudo nginx -t
# Should output: "nginx: configuration file test is successful"

# 5. Reload NGINX
sudo systemctl reload nginx

# 6. Check status
sudo systemctl status nginx
```

### Step 4: Verify Deployment

```bash
# 1. Check backend is running
pm2 ls
# ana-chat-backend should show as "online" with recent uptime

# 2. Check logs for errors
pm2 logs ana-chat-backend --lines 50

# 3. Test health endpoint
curl -v https://api.chat.myana.site/healthz
# Should return: {"status":"ok"}

# 4. Check Socket.IO is initialized
curl -v https://api.chat.myana.site/socket-status
# Should show connected status

# 5. Verify frontend loads
curl -I https://chat.myana.site
# Should return 200

# 6. Set up monitoring
pm2 save
```

---

## ===== POST-DEPLOYMENT VERIFICATION =====

### From Your Computer

```javascript
// 1. Open browser at https://chat.myana.site
// 2. Open DevTools (F12)
// 3. Go to Console tab
// 4. Look for these messages:

"[Socket] Initializing at wss://api.chat.myana.site/"
"[Socket] ✓ Connected successfully"

// NOT:
"WebSocket is closed before the connection is established"
"Unauthorized"
"Connection refused"

// 5. Check Network tab
// - Filter by "WS" for WebSocket
// - Should see socket.io request with "101 Switching Protocols"
// - NOT 400, 403, or 500 errors

// 6. Verify UI shows
// - "Socket Status: Connected"
// - Messages send/receive in real-time
// - No infinite console logs
```

### From Server

```bash
# 1. Check if WebSocket connections are established
netstat -antp | grep 5000 | head -10
# Should see ESTABLISHED connections (not just LISTEN)

# 2. Monitor live connections
watch -n 1 'netstat -antp | grep 5000 | wc -l'
# Should increase as users connect

# 3. Check NGINX is proxying correctly
sudo tail -f /var/log/nginx/access.log | grep socket.io
# Should see WebSocket upgrade requests: 101 status

# 4. Monitor backend memory
pm2 monit
# Check for memory leaks (should stay stable)

# 5. Check CPU usage
top -p $(pm2 pid ana-chat-backend)
# Spike during connections, then stabilize
```

---

## ===== ROLLBACK PROCEDURE =====

If something goes wrong:

```bash
# 1. Immediate backend rollback
pm2 rollback ana-chat-backend
# OR manually:
cp /path/to/ana-chat/backend/src/server.js.backup /path/to/ana-chat/backend/src/server.js
cp /path/to/ana-chat/backend/src/socket.js.backup /path/to/ana-chat/backend/src/socket.js
pm2 restart ana-chat-backend

# 2. Frontend rollback
cd /path/to/ana-chat/frontend
git checkout src/context/SocketContext.jsx
npm run build
# Redeploy

# 3. NGINX rollback
sudo cp /etc/nginx/sites-available/api.chat.myana.site.backup /etc/nginx/sites-available/api.chat.myana.site
sudo systemctl reload nginx

# 4. Monitor recovery
pm2 logs ana-chat-backend
tail -f /var/log/nginx/error.log
```

---

## ===== ENVIRONMENT VARIABLES NEEDED =====

Ensure these are set in your `.env`:

```bash
# Backend .env
NODE_ENV=production
PORT=5000
CLIENT_ORIGIN=https://chat.myana.site,https://www.chat.myana.site
DATABASE_URL=mongodb+srv://...

# Optional: Redis for multiple server instances
REDIS_URL=redis://localhost:6379
```

---

## ===== SCALING TO MULTIPLE BACKEND INSTANCES =====

If adding more backends (for load balancing):

### 1. Update NGINX upstream

```nginx
upstream chat_backend {
    server localhost:5000;
    server localhost:5001;
    server localhost:5002;
    keepalive 64;
}
```

### 2. Configure Redis adapter

Set `REDIS_URL` in backend `.env`:

```bash
REDIS_URL=redis://localhost:6379
```

This enables Socket.IO to share state across instances.

### 3. Start multiple instances

```bash
# Using PM2 cluster mode
pm2 start src/server.js -i 3 --name ana-chat-backend

# OR manually
PORT=5000 npm start
PORT=5001 npm start &
PORT=5002 npm start &
```

### 4. Test cross-instance messaging

Users connected to different backend instances should still receive real-time messages (via Redis adapter).

---

## ===== MONITORING & ALERTS =====

### Set up PM2 Monitoring

```bash
# Install PM2 monitoring
npm install -g pm2-monitoring

# Configure
pm2 link <secret-key> <public-key>

# Monitor at https://app.pm2.io
```

### Set up NGINX Monitoring

```bash
# Install Nginx Exporter for Prometheus
cd /tmp
wget https://github.com/nginxinc/nginx-prometheus-exporter/releases/download/v0.11.0/nginx-prometheus-exporter-0.11.0-linux-amd64.tar.gz
tar xzf nginx-prometheus-exporter-0.11.0-linux-amd64.tar.gz

# Enable nginx stats
# Add to NGINX config:
# server {
#     listen 8080;
#     location /nginx_status {
#         stub_status on;
#         access_log off;
#     }
# }
```

### Key Metrics to Monitor

- **Socket connections**: Should match logged-in users
- **WebSocket upgrade rate**: Should be 100% (no polling fallback)
- **Connection errors**: Should be near 0
- **Backend response time**: Should be <100ms (excluding WebSocket)
- **CPU/Memory**: Should remain stable
- **NGINX access log**: Should show 101 responses for socket.io

---

## ===== PERFORMANCE TUNING =====

### System Limits

```bash
# Increase max open files for Node process
ulimit -n 65535

# Add to pm2 ecosystem.config.js:
instances: 4,
error_file: './logs/err.log',
out_file: './logs/out.log',
exec_mode: 'cluster',
args: '--max-old-space-size=2048',
```

### NGINX Tuning

```nginx
# In /etc/nginx/nginx.conf

# Increase worker processes
worker_processes auto;

# Increase max connections
worker_connections 2048;

# Enable gzip
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

---

## ===== COMMON ERRORS & FIXES =====

### "WebSocket is closed before the connection is established"

```bash
# 1. Check NGINX is forwarding Upgrade header
grep "Upgrade" /etc/nginx/sites-available/api.chat.myana.site

# 2. Check backend is running
pm2 ls

# 3. Check backend logs
pm2 logs ana-chat-backend

# 4. Verify token is valid
curl -H "Authorization: Bearer $(jwt_token)" \
     https://api.chat.myana.site/api/me
```

### "Connection refused"

```bash
# Backend not listening
netstat -tulpn | grep 5000

# Start backend
pm2 restart ana-chat-backend
```

### "Connection timeout"

```bash
# Check NGINX proxy_read_timeout
grep "proxy_read_timeout" /etc/nginx/sites-available/api.chat.myana.site
# Should be high (7d recommended for WebSocket)

# Reload NGINX
sudo systemctl reload nginx
```

### "Too many open files"

```bash
# Increase system limits
sudo sysctl -w fs.file-max=2000000
sudo sysctl -w net.core.somaxconn=1000

# Make permanent
echo "fs.file-max = 2000000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

**DEPLOYMENT COMPLETE!**

Your Socket.IO WebSocket should now be production-ready and stable.

Monitor the first 24 hours closely for any issues.
