# Socket.IO WebSocket Debugging & Verification Guide

## ===== CRITICAL SYSTEM CHECKS =====

### 1. NGINX Configuration Validation

```bash
# Test NGINX config syntax
sudo nginx -t

# Check if NGINX is running
sudo systemctl status nginx

# Reload NGINX changes (without downtime)
sudo nginx -s reload

# View NGINX error log for WebSocket issues
tail -f /var/log/nginx/error.log

# View NGINX access log
tail -f /var/log/nginx/access.log

# Check if NGINX is listening on correct ports
sudo netstat -tulpn | grep nginx
# OR
sudo ss -tulpn | grep nginx
```

### 2. Backend Server Status

```bash
# Check if backend is running on port 5000
netstat -tulpn | grep 5000
# OR
ss -tulpn | grep 5000

# Check process with PM2
pm2 list
pm2 logs ana-chat-backend

# Check backend logs directly
# Might be in /var/log/pm2/ or your log directory
tail -f /var/log/pm2/ana-chat-backend-error.log
tail -f /var/log/pm2/ana-chat-backend-out.log

# Test health endpoint
curl -v https://api.chat.myana.site/healthz
# Response should be: {"status":"ok"}

# Test socket status
curl -v https://api.chat.myana.site/socket-status
```

### 3. SSL/TLS Certificate Validation

```bash
# Check certificate validity
openssl x509 -in /path/to/certificate.crt -text -noout

# Test SSL/TLS connection
openssl s_client -connect api.chat.myana.site:443

# Check certificate expiration
curl -vI https://api.chat.myana.site 2>&1 | grep expire
```

### 4. WebSocket Connection Testing

```bash
# Using wscat (install: npm install -g wscat)
wscat -c 'wss://api.chat.myana.site/socket.io/?EIO=4&transport=websocket'

# Test with verbose output
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  -H "Sec-WebSocket-Version: 13" \
  https://api.chat.myana.site/socket.io/?EIO=4
```

### 5. Reverse Proxy Header Verification

```bash
# Check if NGINX is properly forwarding Upgrade header
curl -v \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  https://api.chat.myana.site/socket.io/ 2>&1 | grep -i upgrade

# Should see:
# < Connection: upgrade
# < Upgrade: websocket
```

### 6. Port and Firewall Checks

```bash
# Check if port 5000 is listening
netstat -tulpn | grep :5000

# Check if ports 80/443 are accessible
curl -v http://api.chat.myana.site
curl -v https://api.chat.myana.site

# Check firewall rules (UFW)
sudo ufw status
sudo ufw show added

# Test connectivity to backend from NGINX
sudo curl http://localhost:5000/healthz
```

---

## ===== BROWSER CONSOLE DEBUGGING =====

### 1. Enable Socket.IO Debug Logging

Open browser console and run:

```javascript
// Enable Socket.IO client debug logs
localStorage.setItem('debug', '*');
window.location.reload();

// After reload, check console - should see verbose Socket.IO logs
// To disable:
localStorage.removeItem('debug');
```

### 2. Check What Socket is Attempting

```javascript
// In browser console
const socket = window.__socket; // Check if accessible

console.log("Socket ID:", socket?.id);
console.log("Is connected:", socket?.connected);
console.log("Connection state:", socket?.readyState);
console.log("Transport:", socket?.io?.engine?.transport?.name);
```

### 3. Verify Token is Available

```javascript
// Check if auth token exists
console.log("Auth token:", localStorage.getItem('access_token'));

// Decode JWT to verify it's not expired
function decodeJWT(token) {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  console.log("Token payload:", payload);
  const expiration = new Date(payload.exp * 1000);
  console.log("Expires at:", expiration);
  console.log("Is expired:", Date.now() > payload.exp * 1000);
}

const token = localStorage.getItem('access_token');
if (token) decodeJWT(token);
```

---

## ===== EXPECTED BEHAVIOR AFTER FIXES =====

### ✓ What Should Happen

**In Browser Console:**

```
[Socket] Initializing at wss://api.chat.myana.site/
[Socket] ✓ Connected successfully {socketId: "Yk-qf93ZAAA4..."}
```

NOT:

```
WebSocket is closed before the connection is established
```

**In Browser DevTools Network Tab:**

1. Find `socket.io` request
2. Should see status `101 Switching Protocols` (NOT 400, 403, 500)
3. Type should be `websocket`
4. Response Headers should include:
   ```
   Connection: Upgrade
   Upgrade: websocket
   Sec-WebSocket-Accept: [hash]
   ```

**In Backend Logs:**

```
[Socket.IO] ✓ Initialized successfully
[Socket.IO] Transports: websocket (primary), polling (fallback)
[Socket.IO] CORS origins configured: https://chat.myana.site
[Socket.IO] User connected: {socketId: ..., userId: 123, ...}
```

**In Browser UI:**

- "Socket Status: Connected" (NOT "Disconnected")
- Messages appear in real-time
- No console spam/infinite loops

---

## ===== TROUBLESHOOTING STEPS =====

### If WebSocket Still Fails

#### Step 1: Verify NGINX WebSocket Headers

```bash
# Check NGINX logs for WebSocket requests
sudo tail -f /var/log/nginx/error.log | grep -i websocket

# Look for error messages like:
# "too many open files in system"
# "Connection refused"
# "upstream timed out"
```

#### Step 2: Check Backend Authentication

```bash
# Look for auth errors in backend logs
tail -f /var/log/pm2/ana-chat-backend-error.log | grep -i auth

# Expected: User authenticated successfully
# Not expected: "Unauthorized" on every connection
```

#### Step 3: Verify NGINX Proxy Pass

```bash
# Test if NGINX can reach backend
sudo curl -v http://localhost:5000/healthz

# Should return 200 with {"status":"ok"}
# If connection refused, backend isn't listening
```

#### Step 4: Check NGINX Buffer Settings

```bash
# View NGINX config for buffering
grep -n "proxy_buffering\|proxy_request_buffering" /etc/nginx/sites-enabled/api.chat.myana.site

# Should see:
# proxy_buffering off;
# proxy_request_buffering off;
```

#### Step 5: Monitor Real-time Traffic

```bash
# Watch NGINX accessing your backend
sudo tcpdump -i any -A 'tcp port 5000' | head -50

# Monitor NGINX upstream connections
netstat -natp | grep 5000
```

---

## ===== PRODUCTION VERIFICATION CHECKLIST =====

- [ ] NGINX config has `proxy_set_header Upgrade $http_upgrade`
- [ ] NGINX config has `proxy_set_header Connection "upgrade"`
- [ ] NGINX config has `proxy_buffering off`
- [ ] NGINX config has `proxy_request_buffering off`
- [ ] Backend uses `http.createServer()` not `app.listen()`
- [ ] Socket.IO is initialized on HTTP server
- [ ] Backend has `pingInterval: 25000` and `pingTimeout: 60000`
- [ ] Frontend socket is a singleton (created once)
- [ ] Frontend socket uses `autoConnect: false` and manual `connect()`
- [ ] Frontend socket has proper auth token included
- [ ] SSL certificates are valid (not expired)
- [ ] Firewall allows port 5000 from NGINX server
- [ ] Backend logs show `[Socket.IO] ✓ Initialized successfully`
- [ ] Browser shows `Socket Status: Connected`
- [ ] No infinite reconnect loops in console
- [ ] Network tab shows WebSocket with 101 status

---

## ===== IF EVERYTHING STILL FAILS =====

### Nuclear Option: Reset Everything

```bash
# 1. Stop all services
pm2 stop all
sudo systemctl stop nginx

# 2. Kill any zombie processes
pkill -9 node
sudo pkill -9 nginx

# 3. Clear logs
pm2 flush
sudo truncate -s 0 /var/log/nginx/error.log

# 4. Start fresh
pm2 start ecosystem.config.js
sudo systemctl start nginx

# 5. Check logs immediately
pm2 logs ana-chat-backend
tail -f /var/log/nginx/error.log
```

### Enable Verbose Debug Logging

**In backend `/backend/src/socket.js`, add after `io = new Server(...)`:**

```javascript
io.on('connection_error', (error) => {
  console.error('[Socket.IO] CONNECTION_ERROR:', {
    message: error.message,
    code: error.code,
    context: error.context,
    data: error.data
  });
});

// Enable debug mode
process.env.DEBUG = 'socket.io:*';
```

**Then restart and check logs:**

```bash
DEBUG=socket.io:* pm2 start backend/src/server.js
```

---

## ===== LOAD TESTING (Post-Fix Verification) =====

Test with multiple concurrent connections:

```bash
# Using artillery (install: npm install -g artillery)

# Create test file: artillery.yml
cat > artillery.yml << 'EOF'
config:
  target: "https://api.chat.myana.site"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Ramp up"

scenarios:
  - name: "WebSocket Connection"
    flow:
      - think: 1
      - connect:
          target: "wss://api.chat.myana.site/socket.io/"
          auth:
            token: "your-jwt-token-here"
          actions:
            - emit: "ping"
            - wait: 2000
            - emit: "heartbeat"
EOF

# Run load test
artillery run artillery.yml
```

Were testing 10 concurrent connections per second for 60 seconds.

Expected result: All connections succeed, no timeouts.
