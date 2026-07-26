import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI || "";
let pool = null;
let useMock = false;

// Mock database storage in case Postgres is unavailable
export const mockDb = {
  users: [],
  admins: [],
  devices: [],
  contacts: [],
  groups: [],
  group_members: [],
  sessions: [],
  public_keys: [],
  backups: [],
  password_reset_tokens: [],
  email_templates: [],
  email_settings: [],
  audit_logs: [],
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
        id BIGINT PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(255),
        device_fingerprint VARCHAR(255),
        ip VARCHAR(100),
        user_agent TEXT,
        revoked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    -- Add missing columns to existing sessions table (for zero-downtime upgrades)
    await query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255);`).catch(() => {});
    await query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);`).catch(() => {});
    await query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip VARCHAR(100);`).catch(() => {});
    await query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;`).catch(() => {});
    await query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`).catch(() => {});

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

    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200),
        username VARCHAR(100) UNIQUE,
        email VARCHAR(255) UNIQUE,
        mobile VARCHAR(30) UNIQUE,
        role VARCHAR(50) DEFAULT 'admin',
        password_hash VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        linked_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        template_key VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        sender_name VARCHAR(200) DEFAULT 'AnaChat',
        reply_to VARCHAR(255) DEFAULT '',
        html_content TEXT NOT NULL DEFAULT '',
        plain_text TEXT NOT NULL DEFAULT '',
        header_html TEXT DEFAULT '',
        footer_html TEXT DEFAULT '',
        button_color VARCHAR(20) DEFAULT '#e11d48',
        brand_color VARCHAR(20) DEFAULT '#e11d48',
        bg_color VARCHAR(20) DEFAULT '#f8fafc',
        logo_url TEXT DEFAULT '',
        support_email VARCHAR(255) DEFAULT '',
        social_links JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) DEFAULT 'smtp',
        smtp_host VARCHAR(255) DEFAULT '',
        smtp_port INT DEFAULT 587,
        smtp_user VARCHAR(255) DEFAULT '',
        smtp_pass TEXT DEFAULT '',
        smtp_encryption VARCHAR(20) DEFAULT 'tls',
        sender_email VARCHAR(255) DEFAULT '',
        sender_name VARCHAR(200) DEFAULT 'AnaChat',
        reply_to VARCHAR(255) DEFAULT '',
        resend_api_key TEXT DEFAULT '',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT,
        admin_id INT,
        action VARCHAR(200) NOT NULL,
        metadata JSONB DEFAULT '{}',
        ip VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default email templates if none exist
    const existing = await query("SELECT COUNT(*) FROM email_templates");
    if (Number(existing.rows[0].count) === 0) {
      await seedDefaultEmailTemplates();
    }

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

  // admins collection mock
  if (norm.includes("from admins") || norm.startsWith("insert into admins") || norm.startsWith("update admins") || norm.startsWith("delete from admins") || norm.includes("select count(*) from admins")) {
    // INSERT
    if (norm.startsWith("insert into admins")) {
      const id = (mockDb.admins?.length || 0) + 1;
      const row = {
        id,
        name: params[0] || null,
        username: params[1] || null,
        email: params[2] || null,
        mobile: params[3] || null,
        role: params[4] || "admin",
        password_hash: params[5] || null,
        is_active: params[6] !== false,
        linked_user_id: params[7] ? Number(params[7]) : null,
        created_at: new Date(),
        updated_at: new Date()
      };
      if (!mockDb.admins) mockDb.admins = [];
      mockDb.admins.push(row);
      return { rows: [row] };
    }
    // COUNT
    if (norm.includes("count(*)")) {
      const role = params[0];
      if (!mockDb.admins) mockDb.admins = [];
      const count = role ? mockDb.admins.filter(a => a.role === role).length : mockDb.admins.length;
      return { rows: [{ count: String(count) }] };
    }
    // SELECT by id
    if (norm.includes("where id =")) {
      if (!mockDb.admins) mockDb.admins = [];
      const row = mockDb.admins.find(a => a.id === Number(params[0]));
      return { rows: row ? [row] : [] };
    }
    // SELECT by email/username/mobile (various $or patterns)
    if (norm.includes("lower(email)") || norm.includes("lower(username)") || norm.includes("mobile")) {
      if (!mockDb.admins) mockDb.admins = [];
      const emailVal = (params[0] || "").toLowerCase();
      const usernameVal = (params[1] || "").toLowerCase();
      const mobileVal = params[2] || "";
      const row = mockDb.admins.find(a =>
        (emailVal && a.email && a.email.toLowerCase() === emailVal) ||
        (usernameVal && a.username && a.username.toLowerCase() === usernameVal) ||
        (mobileVal && a.mobile === mobileVal)
      );
      return { rows: row ? [row] : [] };
    }
    // SELECT all
    if (norm.startsWith("select") && norm.includes("from admins")) {
      if (!mockDb.admins) mockDb.admins = [];
      return { rows: mockDb.admins };
    }
    // UPDATE
    if (norm.startsWith("update admins")) {
      if (!mockDb.admins) mockDb.admins = [];
      const adminId = params[params.length - 1];
      const row = mockDb.admins.find(a => a.id === Number(adminId));
      if (row) row.updated_at = new Date();
      return { rows: row ? [row] : [] };
    }
    // DELETE
    if (norm.startsWith("delete from admins")) {
      if (!mockDb.admins) mockDb.admins = [];
      const adminId = Number(params[0]);
      mockDb.admins = mockDb.admins.filter(a => a.id !== adminId);
      return { rows: [] };
    }
    return { rows: [] };
  }

  // password_reset_tokens
  if (norm.startsWith("insert into password_reset_tokens")) {
    const id = mockDb.password_reset_tokens.length + 1;
    const row = { id, user_id: Number(params[0]), token_hash: params[1], expires_at: new Date(params[2]), used: false, created_at: new Date() };
    mockDb.password_reset_tokens.push(row);
    return { rows: [row] };
  }
  if (norm.includes("from password_reset_tokens where token_hash")) {
    const row = mockDb.password_reset_tokens.find(r => r.token_hash === params[0] && !r.used && new Date(r.expires_at) > new Date());
    return { rows: row ? [row] : [] };
  }
  if (norm.includes("update password_reset_tokens set used")) {
    const row = mockDb.password_reset_tokens.find(r => r.token_hash === params[1]);
    if (row) row.used = true;
    return { rows: row ? [row] : [] };
  }
  if (norm.includes("delete from password_reset_tokens where user_id")) {
    const userId = Number(params[0]);
    mockDb.password_reset_tokens = mockDb.password_reset_tokens.filter(r => r.user_id !== userId);
    return { rows: [] };
  }

  // email_templates
  if (norm.includes("from email_templates")) {
    if (params[0]) {
      const row = mockDb.email_templates.find(r => r.template_key === params[0]);
      return { rows: row ? [row] : [] };
    }
    return { rows: mockDb.email_templates };
  }
  if (norm.startsWith("insert into email_templates") || (norm.includes("email_templates") && norm.includes("on conflict"))) {
    const key = params[0];
    let row = mockDb.email_templates.find(r => r.template_key === key);
    if (row) {
      Object.assign(row, { subject: params[2], html_content: params[3], plain_text: params[4], sender_name: params[5], reply_to: params[6], button_color: params[7], brand_color: params[8], bg_color: params[9], logo_url: params[10], support_email: params[11], social_links: params[12], header_html: params[13], footer_html: params[14], updated_at: new Date() });
    } else {
      row = { id: mockDb.email_templates.length + 1, template_key: key, name: params[1], subject: params[2], html_content: params[3] || '', plain_text: params[4] || '', sender_name: params[5] || 'AnaChat', reply_to: params[6] || '', button_color: params[7] || '#e11d48', brand_color: params[8] || '#e11d48', bg_color: params[9] || '#f8fafc', logo_url: params[10] || '', support_email: params[11] || '', social_links: params[12] || '[]', header_html: params[13] || '', footer_html: params[14] || '', is_active: true, created_at: new Date(), updated_at: new Date() };
      mockDb.email_templates.push(row);
    }
    return { rows: [row] };
  }

  // email_settings
  if (norm.includes("from email_settings")) {
    return { rows: mockDb.email_settings.length ? [mockDb.email_settings[0]] : [] };
  }
  if (norm.includes("into email_settings") || (norm.includes("email_settings") && norm.includes("on conflict"))) {
    const row = { id: 1, provider: params[0], smtp_host: params[1], smtp_port: Number(params[2]), smtp_user: params[3], smtp_pass: params[4], smtp_encryption: params[5], sender_email: params[6], sender_name: params[7], reply_to: params[8], resend_api_key: params[9], updated_at: new Date() };
    mockDb.email_settings = [row];
    return { rows: [row] };
  }

  // audit_logs insert
  if (norm.startsWith("insert into audit_logs")) {
    const row = { id: mockDb.audit_logs.length + 1, user_id: params[0] || null, admin_id: params[1] || null, action: params[2], metadata: params[3] || '{}', ip: params[4] || null, created_at: new Date() };
    mockDb.audit_logs.push(row);
    return { rows: [row] };
  }

  return { rows: [] };
}

// Seed default email templates
async function seedDefaultEmailTemplates() {
  const defaultTemplates = [
    {
      key: "forgot_password",
      name: "Forgot Password",
      subject: "Reset your AnaChat password",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="color:#e11d48;margin:0">🔒 AnaChat</h1>
  </div>
  <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e2e8f0">
    <h2 style="color:#0f172a;margin-top:0">Reset Your Password</h2>
    <p style="color:#475569">Hi {{user_name}},</p>
    <p style="color:#475569">We received a request to reset the password for your AnaChat account associated with <strong>{{user_email}}</strong>.</p>
    <p style="color:#475569">Click the button below to reset your password. This link will expire in <strong>{{expiry_time}}</strong>.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="{{reset_link}}" style="background:{{button_color}};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block">Reset Password</a>
    </div>
    <p style="color:#94a3b8;font-size:13px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
    <p style="color:#94a3b8;font-size:13px">This link will expire in {{expiry_time}}.</p>
  </div>
  <div style="text-align:center;margin-top:24px;color:#94a3b8;font-size:12px">
    <p>&copy; {{current_year}} {{brand_name}}. All rights reserved.</p>
    <p>Need help? Contact us at <a href="mailto:{{support_email}}" style="color:#e11d48">{{support_email}}</a></p>
  </div>
</div>`,
      plain_text: `Reset your AnaChat password\n\nHi {{user_name}},\n\nReset your password: {{reset_link}}\n\nThis link expires in {{expiry_time}}.\n\nIf you didn't request this, ignore this email.\n\n{{brand_name}} Team`
    },
    {
      key: "welcome",
      name: "Welcome Email",
      subject: "Welcome to {{brand_name}}! 🎉",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
  <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e2e8f0">
    <h2 style="color:#0f172a">Welcome to {{brand_name}}! 🎉</h2>
    <p style="color:#475569">Hi {{user_name}}, your account is ready. Start chatting securely!</p>
    <div style="text-align:center;margin:32px 0">
      <a href="{{website}}" style="background:{{button_color}};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Open AnaChat</a>
    </div>
  </div>
  <div style="text-align:center;margin-top:24px;color:#94a3b8;font-size:12px">
    <p>&copy; {{current_year}} {{brand_name}}</p>
  </div>
</div>`,
      plain_text: `Welcome to {{brand_name}}!\n\nHi {{user_name}}, your account is ready.\n\nVisit: {{website}}`
    },
    {
      key: "login_alert",
      name: "Login Alert",
      subject: "New login to your AnaChat account",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
  <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e2e8f0">
    <h2 style="color:#0f172a">🔔 New Login Detected</h2>
    <p style="color:#475569">Hi {{user_name}}, a new login was detected on your account.</p>
    <p style="color:#475569">If this wasn't you, please reset your password immediately.</p>
  </div>
  <div style="text-align:center;margin-top:24px;color:#94a3b8;font-size:12px">
    <p>&copy; {{current_year}} {{brand_name}}</p>
  </div>
</div>`,
      plain_text: `New Login Detected\n\nHi {{user_name}}, a new login was detected. If this wasn't you, reset your password.`
    },
    {
      key: "password_changed",
      name: "Password Changed",
      subject: "Your AnaChat password was changed",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
  <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e2e8f0">
    <h2 style="color:#0f172a">🔐 Password Changed</h2>
    <p style="color:#475569">Hi {{user_name}}, your AnaChat password was successfully updated.</p>
    <p style="color:#475569">If you didn't make this change, contact us at <a href="mailto:{{support_email}}">{{support_email}}</a> immediately.</p>
  </div>
  <div style="text-align:center;margin-top:24px;color:#94a3b8;font-size:12px">
    <p>&copy; {{current_year}} {{brand_name}}</p>
  </div>
</div>`,
      plain_text: `Your AnaChat password was changed.\n\nIf you didn't do this, contact {{support_email}} immediately.`
    },
    {
      key: "backup_completed",
      name: "Backup Completed",
      subject: "Your AnaChat backup is ready",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc"><div style="background:#fff;border-radius:8px;padding:32px"><h2>✅ Backup Completed</h2><p>Hi {{user_name}}, your AnaChat data backup has been completed successfully.</p></div><p style="text-align:center;color:#94a3b8;font-size:12px">&copy; {{current_year}} {{brand_name}}</p></div>`,
      plain_text: `Backup Completed\n\nHi {{user_name}}, your AnaChat backup is ready.`
    },
    {
      key: "backup_failed",
      name: "Backup Failed",
      subject: "AnaChat backup failed",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc"><div style="background:#fff;border-radius:8px;padding:32px"><h2>❌ Backup Failed</h2><p>Hi {{user_name}}, your AnaChat data backup failed. Please try again.</p></div><p style="text-align:center;color:#94a3b8;font-size:12px">&copy; {{current_year}} {{brand_name}}</p></div>`,
      plain_text: `Backup Failed\n\nHi {{user_name}}, your AnaChat backup failed. Please try again.`
    },
    {
      key: "security_alert",
      name: "Security Alert",
      subject: "Security alert for your AnaChat account",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc"><div style="background:#fff;border-radius:8px;padding:32px"><h2>🛡️ Security Alert</h2><p>Hi {{user_name}}, there was a security event on your account. If you didn't authorize this, please reset your password.</p></div><p style="text-align:center;color:#94a3b8;font-size:12px">&copy; {{current_year}} {{brand_name}}</p></div>`,
      plain_text: `Security Alert\n\nHi {{user_name}}, there was a security event on your account.`
    },
    {
      key: "account_locked",
      name: "Account Locked",
      subject: "Your AnaChat account has been locked",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc"><div style="background:#fff;border-radius:8px;padding:32px"><h2>🔒 Account Locked</h2><p>Hi {{user_name}}, your AnaChat account has been temporarily locked due to multiple failed login attempts. Contact support at {{support_email}}.</p></div><p style="text-align:center;color:#94a3b8;font-size:12px">&copy; {{current_year}} {{brand_name}}</p></div>`,
      plain_text: `Account Locked\n\nHi {{user_name}}, your account has been locked. Contact {{support_email}}.`
    }
  ];

  for (const tpl of defaultTemplates) {
    await query(
      `INSERT INTO email_templates (template_key, name, subject, html_content, plain_text)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (template_key) DO NOTHING`,
      [tpl.key, tpl.name, tpl.subject, tpl.html, tpl.plain_text]
    ).catch(() => {});
    // Also seed mock
    if (!mockDb.email_templates.find(r => r.template_key === tpl.key)) {
      mockDb.email_templates.push({
        id: mockDb.email_templates.length + 1,
        template_key: tpl.key,
        name: tpl.name,
        subject: tpl.subject,
        html_content: tpl.html,
        plain_text: tpl.plain_text,
        sender_name: 'AnaChat',
        reply_to: '',
        button_color: '#e11d48',
        brand_color: '#e11d48',
        bg_color: '#f8fafc',
        logo_url: '',
        support_email: '',
        social_links: '[]',
        header_html: '',
        footer_html: '',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }
}
