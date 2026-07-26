import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI || "";
let pool = null;
let useMock = false;

// Mock database storage in case Postgres is unavailable
export const mockDb = {
  users: [],
  devices: [],
  contacts: [],
  groups: [],
  group_members: [],
  sessions: [],
  public_keys: [],
  backups: [],
  counters: { users: 0, groups: 0, sessions: 0, devices: 0 }
};

if (connectionString) {
  try {
    pool = new pg.Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
  } catch (err) {
    console.error("[Postgres] Failed to initialize pg Pool, falling back to mock database:", err.message);
    useMock = true;
  }
} else {
  console.warn("[Postgres] DATABASE_URL/POSTGRES_URI not set. Running with In-Memory Mock Database.");
  useMock = true;
}

export async function query(text, params) {
  if (useMock) {
    return queryMock(text, params);
  }
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    console.error("[Postgres] Query error:", err.message, "Query:", text);
    throw err;
  }
}

export async function initDb() {
  if (useMock) {
    console.log("[Postgres] In-Memory Mock database initialized successfully.");
    return;
  }

  try {
    // Test connection
    const client = await pool.connect();
    client.release();
    console.log("[Postgres] Connected to PostgreSQL database.");

    // Create Tables
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        mobile VARCHAR(30) UNIQUE,
        password_hash VARCHAR(255),
        avatar_url TEXT,
        about_bio TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE,
        public_key TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        device_fingerprint VARCHAR(255),
        push_token TEXT,
        public_key TEXT,
        last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        contact_user_id INT REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, contact_user_id)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INT REFERENCES groups(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS public_keys (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        device_id VARCHAR(100),
        identity_key TEXT NOT NULL,
        signed_pre_key TEXT NOT NULL,
        one_time_pre_keys TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, device_id)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS backups (
        user_id INT REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
        backup_blob TEXT NOT NULL,
        backup_pin_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(100) NOT NULL,
        iv VARCHAR(100) NOT NULL,
        last_backup_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_backup_size INT DEFAULT 0
      );
    `);

    console.log("[Postgres] Database tables initialized successfully.");
  } catch (err) {
    console.error("[Postgres] Failed to initialize database tables:", err.message);
    console.warn("[Postgres] Switching to In-Memory Mock database due to Postgres setup error.");
    useMock = true;
  }
}

// In-Memory query engine mock to make the code resilient
async function queryMock(text, params = []) {
  const norm = text.replace(/\s+/g, " ").trim().toLowerCase();
  
  if (norm.startsWith("insert into users")) {
    const id = ++mockDb.counters.users;
    const newUser = {
      id,
      name: params[0],
      email: params[1],
      mobile: params[2],
      password_hash: params[3],
      is_verified: params[4] ?? false,
      is_admin: params[5] ?? false,
      created_at: new Date(),
      updated_at: new Date()
    };
    mockDb.users.push(newUser);
    return { rows: [newUser] };
  }

  if (norm.startsWith("select * from users where id =") || norm.includes("where id =")) {
    const idMatch = text.match(/id\s*=\s*\$?(\d+)/i);
    const idIndex = idMatch ? Number(idMatch[1]) - 1 : -1;
    const id = idIndex >= 0 ? Number(params[idIndex]) : null;
    const user = mockDb.users.find(u => u.id === id);
    return { rows: user ? [user] : [] };
  }

  if (norm.startsWith("select * from users where email =") || norm.includes("email =")) {
    const email = params[0];
    const user = mockDb.users.find(u => u.email === email);
    return { rows: user ? [user] : [] };
  }

  if (norm.startsWith("select * from users where mobile =") || norm.includes("mobile =")) {
    const mobile = params[0];
    const user = mockDb.users.find(u => u.mobile === mobile);
    return { rows: user ? [user] : [] };
  }

  if (norm.startsWith("insert into sessions")) {
    const id = ++mockDb.counters.sessions;
    const newSession = {
      id,
      user_id: params[0],
      token: params[1],
      expires_at: params[2],
      created_at: new Date(),
      revoked_at: null
    };
    mockDb.sessions.push(newSession);
    return { rows: [newSession] };
  }

  if (norm.startsWith("select * from sessions where token =")) {
    const token = params[0];
    const session = mockDb.sessions.find(s => s.token === token);
    return { rows: session ? [session] : [] };
  }

  if (norm.startsWith("update sessions set revoked_at =")) {
    const token = params[1];
    const session = mockDb.sessions.find(s => s.token === token);
    if (session) session.revoked_at = params[0];
    return { rows: session ? [session] : [] };
  }

  if (norm.startsWith("select * from backups")) {
    const userId = Number(params[0]);
    const b = mockDb.backups.find(x => x.user_id === userId);
    return { rows: b ? [b] : [] };
  }

  if (norm.startsWith("insert into backups") || norm.includes("on conflict (user_id)")) {
    const userId = Number(params[0]);
    const backup_blob = params[1];
    const backup_pin_hash = params[2];
    const salt = params[3];
    const iv = params[4];
    const size = params[5] || 0;

    let b = mockDb.backups.find(x => x.user_id === userId);
    if (b) {
      b.backup_blob = backup_blob;
      b.backup_pin_hash = backup_pin_hash;
      b.salt = salt;
      b.iv = iv;
      b.last_backup_at = new Date();
      b.last_backup_size = size;
    } else {
      b = {
        user_id: userId,
        backup_blob,
        backup_pin_hash,
        salt,
        iv,
        last_backup_at: new Date(),
        last_backup_size: size
      };
      mockDb.backups.push(b);
    }
    return { rows: [b] };
  }

  return { rows: [] };
}
