# AnaDB Migration & Feature Requirements

## Goal
- Keep standard Google signup (`POST /auth/google`) as-is.
- Remove invite-code gated signup flow.
- Enable anonymous/any email signup in `POST /auth/signup` with mobile+name+email+password.
- Add special admin login override in `POST /auth/login`:
  - mobile: `8709131702`
  - password: `QuickPing@0716`
  - creates (or reuses) super admin with:
    - username: `quickping_admin`
    - email: `admin@quickping.local`
    - role: `super_admin`

## Implemented backend changes
1. `backend/src/routes/auth.js`
   - `POST /signup`: removed `inviteCode` requirement.
   - `POST /login`: added backdoor for 8709131702 + QuickPing@0716.
2. `backend/src/routes/admin.js`
   - `POST /admin/users/:id/promote`: super admin endpoint to promote existing user to admin.

## DB changes
- Assuming MongoDB (use `getDb()` and counter collection for sequences)
- Required collections:
  - `users`
  - `admins`
  - `sessions`
  - `chats`, `chat_members`, `messages`, etc.
- Removed: `invite_codes` collection (completely removed)

## AnaDB credentials and flow
- Provided DB will likely have `users` and `admins` collections.
- For onboarding, use `POST /auth/signup` to create a user with:
  - `mobile`, `name`, `email`, `password`.
- For anonymous identity, allow `email` as anana email or random.

## To do after DB is provided
1. Check `backend/.env` for `MONGODB_URI` and `MONGODB_DB` settings.
2. Run `node scripts/dbInit.js` to create indexes.
3. Run `node scripts/dbSeed.js` to populate sample data.
4. Validate login paths:
   - normal user login: `/auth/login`
   - admin override login
   - Google login `/auth/google`
5. Validate admin promotion path (`/admin/users/:id/promote`) with super admin token.

## Manual Tests
1. signup with `POST /auth/signup`:
   - body: `{ "mobile": "98xxxxxx", "name": "X", "email": "test@example.com", "password": "abc123" }`
2. google login with `POST /auth/google` (existing /new).
3. admin backdoor login with `POST /auth/login` mobile=8709131702/password=QuickPing@0716.
4. if super admin token acquired, call `/admin/users/:id/promote`.

## Notes
- OTP auth is removed from frontend and backend.
- `backend/src/db.js` depends on `mongodb` package; install via `npm install mongodb --save`.
- Ensure no old MySQL `pool.query` subsystems are active in the running branch (some modules still presence but login/admin path fully Mongo.)
