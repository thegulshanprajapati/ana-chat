# AnaChat Monorepo Architecture

AnaChat is built as a monorepo with shared business logic and multiple client apps.

## Structure

- `apps/web`: Web application built with Next.js 15, React 19, TailwindCSS, shadcn/ui, Framer Motion.
- `apps/admin`: Admin dashboard built as a Next.js application.
- `apps/backend`: Shared Node.js backend with Express, Socket.IO, MongoDB, Redis, Cloudflare R2 / S3-compatible storage.
- `apps/desktop`: Electron desktop shell with SQLite local storage and native OS integration.
- `apps/mobile`: React Native mobile app with SQLite and MMKV.
- `packages/*`: Shared business logic, API client, auth helpers, socket contract, crypto utilities, validation schemas, UI primitives, and TypeScript types.

## Principles

- MongoDB is the primary server database.
- PostgreSQL is removed completely from the new foundation.
- Server stores metadata only; chat messages are local-first and never stored permanently.
- Redis provides ephemeral offline message queueing for 24-hour delivery.
- Backup data is encrypted locally and stored on the server as opaque encrypted payload.
