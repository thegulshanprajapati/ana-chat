# Socket.IO WebSocket - Quick Reference Guide

## ===== THE 5 CRITICAL FIXES =====

### FIX #1: NGINX Buffering (BLOCKING WebSocket)

**Problem**: NGINX buffers response, WebSocket upgrade never completes

**Before**:
```nginx
location /socket.io/ {
    proxy_pass http://chat_backend;
    # ❌ Missing: proxy_buffering off;
}
```

**After**:
```nginx
location /socket.io/ {
    proxy_pass http://chat_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # ✓ CRITICAL: Disable buffering
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    
    # ✓ CRITICAL: Long timeouts for persistent connection
    proxy_read_timeout 7d;
    proxy_send_timeout 7d;
    proxy_connect_timeout 7d;
}
```

**File**: `/etc/nginx/sites-available/api.chat.myana.site` (or nginx-production.conf)

---

### FIX #2: HTTP Server Creation (Socket.IO Attachment)

**Problem**: Socket.IO not properly attached to server, WebSocket fails

**Before**:
```javascript
// ❌ WRONG - Express internal server
app.listen(5000);

// OR inconsistent server object
function startServer() {
    const server = createServer(app);
    // ... server goes out of scope after function
}
```

**After**:
```javascript
// ✓ Module-level HTTP server
import http from "http";
let httpServer = null;

function startServer(port) {
    // ✓ Create explicit HTTP server
    httpServer = http.createServer(app);
    
    // ✓ Listen on server (NOT app)
    httpServer.listen(port, "0.0.0.0", () => {
        console.log(`[Server] ✓ HTTP Server listening on 0.0.0.0:${port}`);
    });
    
    // ✓ Initialize Socket.IO on server
    initSocket(httpServer)
        .then((io) => {
            app.set("io", io);
            httpServer.io = io;
        });
}
```

**File**: `backend/src/server.js`

---

### FIX #3: Socket.IO Production Heartbeat

**Problem**: No ping/pong, connections timeout randomly

**Before**:
```javascript
// ❌ Missing heartbeat configuration
const io = new Server(httpServer, {
    cors: { /* ... */ },
    transports: ["websocket", "polling"]
});
```

**After**:
```javascript
// ✓ Production-grade heartbeat
const io = new Server(httpServer, {
    cors: { /* ... */ },
    transports: ["websocket", "polling"],
    
    // ✓ CRITICAL: Heartbeat configuration
    pingInterval: 25000,        // Send ping every 25 seconds
    pingTimeout: 60000,         // Expect pong within 60 seconds
    upgradeTimeout: 10000,      // 10 seconds to complete WebSocket upgrade
    maxHttpBufferSize: 1e6,     // 1MB buffer
    path: "/socket.io/",
});
```

**File**: `backend/src/socket.js`

---

### FIX #4: Frontend Singleton Socket (Prevent Recreation)

**Problem**: Socket recreated on every React render, causing infinite reconnect storms

**Before**:
```javascript
// ❌ WRONG - Created inside component
export function SocketProvider({ children }) {
    const [socket, setSocket] = useState(null);
    
    useEffect(() => {
        // ❌ NEW socket created every time!
        const socketInstance = io(SOCKET_BASE_URL, {...});
        setSocket(socketInstance);
    }, [user]); // ← Re-creates when user changes
}
```

**After**:
```javascript
// ✓ frontend/src/utils/socket.js - Created ONCE globally
let socketInstance = null;

export function initializeSocket() {
    if (socketInstance) return socketInstance;
    
    // ✓ Create socket ONCE at module load
    socketInstance = io(SOCKET_BASE_URL, {
        reconnection: false,  // Manual control
        autoConnect: false,   // Manual connection
        forceNew: false,      // Reuse existing
    });
    
    return socketInstance;
}

// ✓ frontend/src/context/SocketContextNew.jsx - Provider only tracks state
export function SocketProvider({ children }) {
    const [connectionState, setConnectionState] = useState('disconnected');
    
    useEffect(() => {
        // ✓ Just subscribe to state changes
        initializeSocket().then((socket) => {
            subscribe((state) => setConnectionState(state));
        });
        // Socket NOT recreated
    }, []);
}
```

**Files**:
- Create: `frontend/src/utils/socket.js`
- Create: `frontend/src/context/SocketContextNew.jsx`
- Update: `frontend/src/App.jsx` to import new provider

---

### FIX #5: Reconnection Limits (Prevent Infinite Loop)

**Problem**: Infinite reconnect attempts when auth fails

**Before**:
```javascript
// ❌ Infinite retry loop
if (reason !== 'io client disconnect' && isOnlineRef.current && 
    reconnectAttemptsRef.current < maxReconnectAttempts) {
    // Still retries even after hitting limit
    const delay = ...; // exponential backoff
    reconnectTimerRef.current = setTimeout(() => {
        socketInstance.connect();
    }, delay);
}
```

**After**:
```javascript
// ✓ Proper backoff with max attempts
const MAX_RECONNECT_ATTEMPTS = 25; // ~5 minutes total

if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[Socket] Max reconnection attempts reached (${MAX_RECONNECT_ATTEMPTS})`);
    notifyListeners("error");
    return false; // ✓ Stop retrying
}

reconnectAttempts++;

// ✓ Exponential backoff: 1s, 2s, 4s, 8s, 16s... max 30s
const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);

console.log(`[Socket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

setTimeout(() => {
    socketInstance.connect();
}, delay);
```

**File**: `frontend/src/utils/socket.js`

---

## ===== DEPLOYMENT SUMMARY =====

### 1. Backend (5 minutes)

```bash
cd backend
# server.js and socket.js already updated
npm install
pm2 reload ana-chat-backend
pm2 logs ana-chat-backend
```

**Verify**: Should see:
```
[Server] ✓ HTTP Server listening on 0.0.0.0:5000
[Socket.IO] ✓ Initialized successfully
```

### 2. Frontend (10 minutes)

```bash
cd frontend
# Copy new files:
# - utils/socket.js
# - context/SocketContextNew.jsx

# Update App.jsx:
# import { SocketProvider } from "./context/SocketContextNew";

npm run build
# Deploy dist/ to frontend server
```

### 3. NGINX (5 minutes)

```bash
# Copy nginx-production.conf to production server
sudo cp nginx-production.conf /etc/nginx/sites-available/api.chat.myana.site

# Update SSL paths in config
sudo sed -i 's|/path/to/ssl/|/etc/letsencrypt/live/|g' /etc/nginx/sites-available/api.chat.myana.site

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

**Verify**: Should see:
```
nginx: configuration file test is successful
```

---

## ===== VERIFICATION (2 minutes) =====

### Browser Console

Open https://chat.myana.site and check:

```javascript
// ✓ Should see: [Socket] ✓ Connected successfully
// ✓ Should see: Socket Status: Connected (UI)
// ✗ Should NOT see: "WebSocket is closed"
// ✗ Should NOT see: Infinite console spam
```

### DevTools Network Tab

Click on socket.io request and verify:

```
✓ Status: 101 Switching Protocols
✓ Type: websocket
✓ Response Headers include:
  Upgrade: websocket
  Connection: upgrade
```

### Server Logs

```bash
pm2 logs ana-chat-backend | head -50

# ✓ Should see:
# [Socket.IO] ✓ Initialized successfully
# [Socket.IO] User connected: {socketId: ..., userId: ...}
```

---

## ===== TROUBLESHOOTING =====

### Still Showing "WebSocket is closed"

```bash
# 1. Check NGINX buffering
grep "proxy_buffering" /etc/nginx/sites-available/api.chat.myana.site
# Should show: proxy_buffering off;

# 2. Check backend is running
pm2 ls
# ana-chat-backend should show "online"

# 3. Check NGINX is serving correct config
sudo nginx -T | grep socket.io
# Should show your socket.io location block
```

### "Connection refused"

```bash
# Backend not listening
netstat -tulpn | grep 5000
# Should show listening state

# Restart backend
pm2 restart ana-chat-backend
```

### "Unauthorized" in socket logs

```bash
# Token is expired or invalid
# Check token:
console.log(localStorage.getItem('access_token'));

# Refresh the page to get new token
# Browser will auto-reauthenticate
```

---

## ===== ROLLBACK (Emergency) =====

```bash
# If deployment breaks production:

# 1. Revert backend
cp backend/src/server.js.backup backend/src/server.js
cp backend/src/socket.js.backup backend/src/socket.js
pm2 restart ana-chat-backend

# 2. Revert NGINX
sudo cp /etc/nginx/sites-available/api.chat.myana.site.backup /etc/nginx/sites-available/api.chat.myana.site
sudo systemctl reload nginx

# 3. Revert frontend
cd frontend && git checkout src/
npm run build
# Redeploy

# 4. Verify rollback
# Open browser and check socket status
```

---

## ===== SUCCESS INDICATORS =====

✓ Browser shows "Socket Status: Connected"  
✓ Real-time messages appear instantly  
✓ No console spam or errors  
✓ DevTools shows WebSocket 101 status  
✓ Backend accepts multiple concurrent connections  
✓ No infinite reconnect loops  
✓ Graceful reconnection on network recovery  

**Welcome to production-ready WebSocket!** 🚀
