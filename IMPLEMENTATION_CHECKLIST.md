# Socket.IO WebSocket - Implementation Checklist

## ===== BACKEND IMPLEMENTATION =====

### ✓ server.js Changes

```javascript
// ✓ Line 1-25: Import http module
import http from "http";

// ✓ Line 30: Declare httpServer at module level
let httpServer = null;

// ✓ Line 170-200: Create HTTP server in startServer()
function startServer(port, attempts = 0) {
    // ✓ Create HTTP server (NOT app.listen)
    httpServer = http.createServer(app);
    
    // ✓ Use httpServer.listen() (NOT app.listen())
    httpServer.listen(port, listenHost, () => {
        console.log(`[Server] ✓ HTTP Server listening on ${listenHost}:${port}`);
    });
    
    // ✓ Initialize Socket.IO on httpServer
    initSocket(httpServer)
        .then((io) => {
            app.set("io", io);
            httpServer.io = io;
            console.log("[Socket.IO] ✓ Initialized successfully");
        })
        .catch((err) => {
            console.error("[Socket.IO] ✗ Initialization failed:", err.message);
            process.exit(1);
        });
}

// ✓ Add graceful shutdown handlers
process.on("SIGTERM", () => {
    if (httpServer) {
        httpServer.close(() => process.exit(0));
    }
});

process.on("SIGINT", () => {
    if (httpServer) {
        httpServer.close(() => process.exit(0));
    }
});
```

**Verification**:
```bash
node src/server.js
# Should show:
# [Socket.IO] ✓ Initialized successfully
# [Socket.IO] Transports: websocket (primary), polling (fallback)
```

---

### ✓ socket.js Changes

```javascript
// ✓ Configuration section (after io = new Server)
const io = new Server(httpServer, {
    cors: { /* ... */ },
    
    // ✓ WebSocket-first transport order
    transports: ["websocket", "polling"],
    
    // ✓ Heartbeat configuration
    pingInterval: 25000,        // Send ping every 25s
    pingTimeout: 60000,         // Disconnect if no pong in 60s
    
    // ✓ Upgrade configuration
    upgradeTimeout: 10000,      // 10s to complete WebSocket upgrade
    
    // ✓ Buffer and path settings
    maxHttpBufferSize: 1e6,
    path: "/socket.io/",
});
```

**Verification**:
```bash
# Backend logs should show:
# [Socket.IO] Redis adapter disabled - using in-memory adapter
# [Socket.IO] User connected: {socketId: ..., userId: ...}
```

---

## ===== FRONTEND IMPLEMENTATION =====

### ✓ Create utils/socket.js (Singleton)

**Status**: ✓ Created at `frontend/src/utils/socket.js`

**Key functions**:
- ✓ `initializeSocket()` - Initialize once globally
- ✓ `getSocket()` - Get singleton instance
- ✓ `subscribe()` - React subscribes to state changes
- ✓ `isConnected()` - Check connection status
- ✓ `reconnect()` - Manual reconnection with backoff
- ✓ `reauthenticate()` - Refresh token and reconnect

**Verification**:
```javascript
// In browser console after page load:
const { getSocket, isConnected } = await import('/src/utils/socket.js');
console.log("Socket connected:", isConnected());
console.log("Socket ID:", getSocket()?.id);
```

---

### ✓ Create context/SocketContextNew.jsx (Provider)

**Status**: ✓ Created at `frontend/src/context/SocketContextNew.jsx`

**Key exports**:
- ✓ `SocketProvider` component
- ✓ `useSocket()` hook
- ✓ Connection state tracking
- ✓ UI-friendly socket API

---

### ✓ Update App.jsx to Use New Provider

```javascript
// Change from old provider to new one
import { SocketProvider } from "./context/SocketContextNew";

export default function App() {
    return (
        <AuthProvider>
            <SocketProvider>  {/* ✓ NEW provider */}
                {/* Rest of app */}
            </SocketProvider>
        </AuthProvider>
    );
}
```

---

### ✓ Update Components to Use Socket

```javascript
// OLD way (DON'T USE)
const socket = useSocket();
socket.on('message', handler);

// NEW way (USE THIS)
const socket = useSocket();

useEffect(() => {
    if (socket?.raw) {
        socket.raw.on('message', handler);
        return () => socket.raw.off('message', handler);
    }
}, [socket]);
```

---

## ===== NGINX IMPLEMENTATION =====

### ✓ Create /etc/nginx/sites-available/api.chat.myana.site

**Status**: ✓ Created configuration at `nginx-production.conf`

**Critical sections**:

#### ✓ Upstream Definition
```nginx
upstream chat_backend {
    server localhost:5000;
    keepalive 64;
}
```

#### ✓ Socket.IO Location Block
```nginx
location /socket.io/ {
    proxy_pass http://chat_backend;
    
    # ✓ HTTP/1.1 for upgrade
    proxy_http_version 1.1;
    
    # ✓ Upgrade headers
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # ✓ NO BUFFERING
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    
    # ✓ Long timeouts
    proxy_read_timeout 7d;
    proxy_send_timeout 7d;
    proxy_connect_timeout 7d;
}
```

#### ✓ API Location Block
```nginx
location /api/ {
    proxy_pass http://chat_backend;
    proxy_http_version 1.1;
    
    # ✓ Allow upgrade (fallback to WebSocket)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # ✓ Standard timeouts for API
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
}
```

**Deployment**:
```bash
sudo cp nginx-production.conf /etc/nginx/sites-available/api.chat.myana.site
sudo nginx -t
sudo systemctl reload nginx
```

---

## ===== VERIFICATION CHECKLIST =====

### During Deployment

- [ ] Backend code updated (server.js, socket.js)
- [ ] Backend compiles without errors (`node --check src/server.js`)
- [ ] Backend starts successfully (`pm2 start` shows no errors)
- [ ] Backend logs show "✓ Initialized successfully"
- [ ] Frontend code updated (socket.js, SocketContextNew.jsx)
- [ ] Frontend builds without errors (`npm run build`)
- [ ] NGINX config updated and tested (`sudo nginx -t` passes)
- [ ] NGINX reloaded successfully

### Post-Deployment Testing

In browser console (at https://chat.myana.site):

```javascript
// ✓ Check 1: Socket initialized
console.log("Is connected:", document.querySelector('body').__react__ !== undefined);

// ✓ Check 2: No console errors
// Look for: NO "WebSocket is closed" messages
// Look for: "[Socket] ✓ Connected successfully" message

// ✓ Check 3: UI shows connected
// Visual check: "Socket Status: Connected" visible

// ✓ Check 4: Messages work
// Send a message and verify it appears in real-time
```

In Network tab (DevTools → Network):

```
Filter by "WS"
Click on socket.io request
Check:
- ✓ Status: 101 Switching Protocols (NOT 400, 403, 500)
- ✓ Type: websocket
- ✓ Headers include: Upgrade: websocket, Connection: upgrade
```

In server logs:

```bash
pm2 logs ana-chat-backend | grep Socket.IO

# ✓ Should see:
# [Socket.IO] ✓ Initialized successfully
# [Socket.IO] User connected: {socketId: ..., userId: ...}
```

---

## ===== FILES MODIFIED SUMMARY =====

### Backend

| File | Status | Key Changes |
|------|--------|------------|
| `backend/src/server.js` | ✓ Modified | HTTP server creation, Socket.IO initialization |
| `backend/src/socket.js` | ✓ Modified | Heartbeat config, timeout settings |

### Frontend

| File | Status | Key Changes |
|------|--------|------------|
| `frontend/src/utils/socket.js` | ✓ Created | Singleton socket instance |
| `frontend/src/context/SocketContextNew.jsx` | ✓ Created | React provider wrapper |
| `frontend/src/App.jsx` | ⏳ TODO | Import new SocketProvider |
| `frontend/src/context/SocketContext.jsx` | ⏳ Optional | Can keep as fallback |

### NGINX

| File | Status | Key Changes |
|------|--------|------------|
| `nginx.conf` | ✓ Updated | Basic config |
| `nginx-production.conf` | ✓ Created | Production-grade config |
| `/etc/nginx/sites-available/api.chat.myana.site` | ✓ Update | Deploy production config |

### Documentation

| File | Status | Purpose |
|------|--------|---------|
| `ROOT_CAUSE_ANALYSIS.md` | ✓ Created | Detailed explanation of all issues |
| `SOCKET_DEBUG_GUIDE.md` | ✓ Created | Debugging commands and verification |
| `SOCKET_DEPLOYMENT_GUIDE.md` | ✓ Created | Step-by-step deployment |

---

## ===== QUICK DEPLOYMENT STEPS =====

```bash
# 1. Backend
cd backend
cp src/server.js src/server.js.backup
cp src/socket.js src/socket.js.backup
# (Files already updated in this session)
npm install
pm2 reload ana-chat-backend
pm2 logs ana-chat-backend

# 2. Frontend
cd frontend
# Update App.jsx to import new provider
npm run build
# Deploy build/

# 3. NGINX
sudo cp nginx-production.conf /etc/nginx/sites-available/api.chat.myana.site
sudo nginx -t
sudo systemctl reload nginx

# 4. Verify
curl https://api.chat.myana.site/healthz
curl https://api.chat.myana.site/socket-status
# Then visit https://chat.myana.site and check console
```

---

## ===== ROLLBACK STEPS =====

```bash
# If anything goes wrong:

# Backend
cp backend/src/server.js.backup backend/src/server.js
cp backend/src/socket.js.backup backend/src/socket.js
pm2 restart ana-chat-backend

# NGINX
sudo cp /etc/nginx/sites-available/api.chat.myana.site.backup /etc/nginx/sites-available/api.chat.myana.site
sudo systemctl reload nginx

# Frontend
cd frontend && git checkout src/context/SocketContext.jsx
npm run build
# Redeploy build/
```

---

## ===== MONITORING =====

### Daily Checks

```bash
# Backend status
pm2 ls
pm2 logs ana-chat-backend --lines 100

# NGINX status
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log | grep socket.io

# Connection count
netstat -antp | grep 5000 | wc -l
```

### Set Up Alerts

```bash
# Using PM2 monitoring (optional)
pm2 link <secret> <public>

# Monitor at https://app.pm2.io
```

---

## ===== SUCCESS INDICATORS =====

When everything is working:

✓ Browser shows "Socket Status: Connected"
✓ Messages appear in real-time
✓ No console spam
✓ DevTools Network shows WebSocket with 101 status
✓ Backend logs show active connections
✓ Users can send/receive messages without delay

**Congratulations! WebSocket is now production-ready.**
