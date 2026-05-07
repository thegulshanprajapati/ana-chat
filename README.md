# Secure Admin-Controlled Chat (Vite + Express + MongoDB)

Upgraded features:
- Open signup (no invite codes or OTP required)
- JWT in httpOnly cookies + refresh token rotation (manual logout only)
- Admin console (`/admin`) with users/chats/audit logs
- Admin audit trail for all admin read/write actions
- Socket guard (blocked/unverified users cannot connect)

## File Tree (key)
```
chat-app/
  server/
    services/fast2sms.js
    sql/migrations/
      001_init_schema.sql
  backend/
    scripts/
      dbMigrate.js
      dbSeed.js
      dbInit.js
    src/
      middleware/
        auth.js
        admin.js
      routes/
        auth.js
        admin.js
        users.js
        chats.js
        messages.js
      services/
        fast2sms.js
        session.js
        tokens.js
        audit.js
      utils/hash.js
      db.js
      socket.js
      server.js
    .env.example
  src/
    api/client.js
    context/AuthContext.jsx
    context/SocketContext.jsx
    components/
      AuthPage.jsx
      ChatLayout.jsx
      Sidebar.jsx
      ChatList.jsx
      ChatWindow.jsx
      MessageList.jsx
      MessageInput.jsx
      AdminPortal.jsx
    App.jsx
```

## 3 Commands (local)
1. `npm install`
2. `npm run db:init`
3. `npm run dev`

## Required Local Prerequisite
- MySQL must be running on `127.0.0.1:3306` (XAMPP/Laragon).
- Default backend env already set in `backend/.env` for local root user.

## Default Credentials
Admin:
- email: `admin@test.com`
- password: `Admin@12345`

Demo users (seed):
- `demo1@test.com` / `User@12345`
- `demo2@test.com` / `User@12345`

## Security Rules Implemented
- Open signup available to anyone.
- Access token short-lived, refresh token rotated on `/auth/refresh`.
- Session persists via refresh rotation until `/auth/logout`.
- Admin block revokes all sessions; force logout revokes all sessions.
- Every admin endpoint logs action in `audit_logs`.

## Signup Flow
Backend sign-up uses credentials directly.
- POST `/auth/signup` with `name`, `email`, `mobile`, `password`
- no OTP or invite code required
# ana-chat
