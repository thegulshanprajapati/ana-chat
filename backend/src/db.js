import { query, initDb } from "./dbPostgres.js";

let dbInstance = null;

// A simple MongoDB-to-PostgreSQL compatibility layer
class PostgresMongoCollection {
  constructor(name) {
    this.name = name;
  }

  async findOne(filter = {}, options = {}) {
    // 1. users collection
    if (this.name === "users") {
      if (filter.id !== undefined) {
        const id = typeof filter.id === "object" ? (filter.id.$in ? filter.id.$in[0] : null) : filter.id;
        const res = await query("SELECT * FROM users WHERE id = $1 LIMIT 1", [Number(id)]);
        return res.rows[0] || null;
      }
      if (filter.email !== undefined) {
        const res = await query("SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [filter.email]);
        return res.rows[0] || null;
      }
      if (filter.mobile !== undefined) {
        const res = await query("SELECT * FROM users WHERE mobile = $1 LIMIT 1", [filter.mobile]);
        return res.rows[0] || null;
      }
      if (filter.$or) {
        const emailCond = filter.$or.find(x => x.email !== undefined)?.email;
        const mobileCond = filter.$or.find(x => x.mobile !== undefined)?.mobile;
        const res = await query(
          "SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR mobile = $2 LIMIT 1",
          [emailCond || "", mobileCond || ""]
        );
        return res.rows[0] || null;
      }
    }

    // 2. admins collection
    if (this.name === "admins") {
      if (filter.id !== undefined) {
        const res = await query("SELECT * FROM admins WHERE id = $1 LIMIT 1", [Number(filter.id)]);
        return res.rows[0] || null;
      }
      if (filter.email !== undefined) {
        const res = await query("SELECT * FROM admins WHERE LOWER(email) = LOWER($1) LIMIT 1", [filter.email]);
        return res.rows[0] || null;
      }
      if (filter.username !== undefined) {
        const res = await query("SELECT * FROM admins WHERE LOWER(username) = LOWER($1) LIMIT 1", [filter.username]);
        return res.rows[0] || null;
      }
      if (filter.mobile !== undefined) {
        const res = await query("SELECT * FROM admins WHERE mobile = $1 LIMIT 1", [filter.mobile]);
        return res.rows[0] || null;
      }
      if (filter.$or) {
        const conds = filter.$or;
        const emailVal = conds.find(x => x.email !== undefined)?.email || "";
        const usernameVal = conds.find(x => x.username !== undefined)?.username || "";
        const mobileVal = conds.find(x => x.mobile !== undefined)?.mobile || "";
        const res = await query(
          `SELECT * FROM admins WHERE
            LOWER(email) = LOWER($1)
            OR LOWER(username) = LOWER($2)
            OR mobile = $3
           LIMIT 1`,
          [emailVal, usernameVal, mobileVal]
        );
        return res.rows[0] || null;
      }
    }

    // 3. sessions collection
    if (this.name === "sessions") {
      if (filter.token) {
        const res = await query("SELECT * FROM sessions WHERE token = $1 LIMIT 1", [filter.token]);
        return res.rows[0] || null;
      }
      if (filter.id && filter.user_id) {
        const res = await query("SELECT * FROM sessions WHERE id = $1 AND user_id = $2 LIMIT 1", [Number(filter.id), Number(filter.user_id)]);
        return res.rows[0] || null;
      }
    }

    // 3. backups collection
    if (this.name === "backups") {
      if (filter.user_id !== undefined) {
        const res = await query("SELECT * FROM backups WHERE user_id = $1 LIMIT 1", [Number(filter.user_id)]);
        return res.rows[0] || null;
      }
    }

    // 4. public_keys collection
    if (this.name === "public_keys") {
      if (filter.user_id !== undefined) {
        const devId = filter.device_id || "default";
        const res = await query("SELECT * FROM public_keys WHERE user_id = $1 AND device_id = $2 LIMIT 1", [Number(filter.user_id), devId]);
        return res.rows[0] || null;
      }
    }

    // Generic fallback: return null
    return null;
  }

  async insertOne(doc) {
    if (this.name === "users") {
      const res = await query(
        `INSERT INTO users (id, name, email, mobile, password_hash, avatar_url, about_bio, is_verified, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          doc.id,
          doc.name,
          doc.email,
          doc.mobile,
          doc.password_hash,
          doc.avatar_url || null,
          doc.about_bio || null,
          doc.is_verified || false,
          doc.is_admin || false
        ]
      );
      return { insertedId: doc.id, value: res.rows[0] };
    }

    if (this.name === "admins") {
      const res = await query(
        `INSERT INTO admins (name, username, email, mobile, role, password_hash, is_active, linked_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          doc.name || null,
          doc.username || null,
          doc.email || null,
          doc.mobile || null,
          doc.role || "admin",
          doc.password_hash || null,
          doc.is_active !== false,
          doc.linked_user_id ? Number(doc.linked_user_id) : null
        ]
      );
      return { insertedId: res.rows[0]?.id, value: res.rows[0] };
    }

    if (this.name === "audit_logs") {
      const res = await query(
        `INSERT INTO audit_logs (user_id, admin_id, action, metadata, ip)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          doc.user_id ? Number(doc.user_id) : null,
          doc.admin_id ? Number(doc.admin_id) : null,
          doc.action || "",
          typeof doc.metadata === "object" ? JSON.stringify(doc.metadata) : (doc.metadata || "{}"),
          doc.ip || null
        ]
      );
      return { insertedId: res.rows[0]?.id, value: res.rows[0] };
    }

    if (this.name === "sessions") {
      const res = await query(
        `INSERT INTO sessions (user_id, token, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [Number(doc.user_id), doc.token, new Date(doc.expires_at), doc.revoked_at ? new Date(doc.revoked_at) : null]
      );
      return { insertedId: res.rows[0]?.id, value: res.rows[0] };
    }

    if (this.name === "backups") {
      const res = await query(
        `INSERT INTO backups (user_id, backup_blob, backup_pin_hash, salt, iv, last_backup_size)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           backup_blob = EXCLUDED.backup_blob,
           backup_pin_hash = EXCLUDED.backup_pin_hash,
           salt = EXCLUDED.salt,
           iv = EXCLUDED.iv,
           last_backup_at = CURRENT_TIMESTAMP,
           last_backup_size = EXCLUDED.last_backup_size
         RETURNING *`,
        [Number(doc.user_id), doc.backup_blob, doc.backup_pin_hash, doc.salt, doc.iv, doc.last_backup_size || 0]
      );
      return { insertedId: doc.user_id, value: res.rows[0] };
    }

    if (this.name === "public_keys") {
      const devId = doc.device_id || "default";
      const res = await query(
        `INSERT INTO public_keys (user_id, device_id, identity_key, signed_pre_key, one_time_pre_keys)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, device_id) DO UPDATE SET
           identity_key = EXCLUDED.identity_key,
           signed_pre_key = EXCLUDED.signed_pre_key,
           one_time_pre_keys = EXCLUDED.one_time_pre_keys
         RETURNING *`,
        [Number(doc.user_id), devId, doc.identity_key, doc.signed_pre_key, JSON.stringify(doc.one_time_pre_keys || [])]
      );
      return { insertedId: doc.user_id, value: res.rows[0] };
    }

    return { insertedId: null };
  }

  async updateOne(filter, update) {
    const setClause = update.$set || {};

    if (this.name === "users") {
      const id = filter.id;
      const keys = Object.keys(setClause);
      if (!keys.length) return { modifiedCount: 0 };

      const setParts = [];
      const values = [];
      keys.forEach((key, idx) => {
        setParts.push(`${key} = $${idx + 1}`);
        values.push(setClause[key]);
      });
      values.push(Number(id));

      await query(
        `UPDATE users SET ${setParts.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`,
        values
      );
      return { modifiedCount: 1 };
    }

    if (this.name === "admins") {
      const adminId = filter.id;
      const keys = Object.keys(setClause);
      if (!keys.length) return { modifiedCount: 0 };

      const setParts = [];
      const values = [];
      keys.forEach((key, idx) => {
        setParts.push(`${key} = $${idx + 1}`);
        values.push(setClause[key]);
      });
      values.push(Number(adminId));

      await query(
        `UPDATE admins SET ${setParts.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`,
        values
      );
      return { modifiedCount: 1 };
    }

    if (this.name === "sessions") {
      if (filter.token) {
        await query(
          "UPDATE sessions SET revoked_at = $1 WHERE token = $2",
          [setClause.revoked_at ? new Date(setClause.revoked_at) : null, filter.token]
        );
        return { modifiedCount: 1 };
      }
    }

    return { modifiedCount: 0 };
  }

  async deleteOne(filter) {
    if (this.name === "sessions" && filter.token) {
      await query("DELETE FROM sessions WHERE token = $1", [filter.token]);
      return { deletedCount: 1 };
    }
    if (this.name === "backups" && filter.user_id !== undefined) {
      await query("DELETE FROM backups WHERE user_id = $1", [Number(filter.user_id)]);
      return { deletedCount: 1 };
    }
    if (this.name === "admins" && filter.id !== undefined) {
      await query("DELETE FROM admins WHERE id = $1", [Number(filter.id)]);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async countDocuments(filter = {}) {
    if (this.name === "admins") {
      if (filter.role) {
        const res = await query("SELECT COUNT(*) FROM admins WHERE role = $1", [filter.role]);
        return Number(res.rows[0].count);
      }
      const res = await query("SELECT COUNT(*) FROM admins");
      return Number(res.rows[0].count);
    }
    if (this.name === "users") {
      const res = await query("SELECT COUNT(*) FROM users");
      return Number(res.rows[0].count);
    }
    if (this.name === "audit_logs") {
      const res = await query("SELECT COUNT(*) FROM audit_logs");
      return Number(res.rows[0].count);
    }
    return 0;
  }

  find(filter = {}) {
    const execute = async () => {
      if (this.name === "users") {
        const res = await query("SELECT * FROM users ORDER BY name ASC", []);
        return res.rows;
      }
      if (this.name === "admins") {
        const res = await query("SELECT id, name, username, email, mobile, role, is_active, created_at, updated_at FROM admins ORDER BY created_at ASC");
        return res.rows;
      }
      if (this.name === "audit_logs") {
        const res = await query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200");
        return res.rows;
      }
      return [];
    };

    return {
      toArray: () => execute(),
      sort: (_sortObj) => ({ toArray: () => execute() }),
      project: function() { return this; },
      limit: (_n) => ({ toArray: () => execute() })
    };
  }
}

export async function connectDb() {
  if (!dbInstance) {
    await initDb();
    dbInstance = {
      collection: (name) => new PostgresMongoCollection(name)
    };
  }
  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    throw new Error("PostgreSQL is not connected. Call connectDb() first.");
  }
  return dbInstance;
}

export async function withDb(cb) {
  const d = getDb();
  return await cb(d);
}

// Emulate simple sequences/counters using Postgres queries or simple timestamps
export async function getNextSequence(name) {
  if (name === "users") {
    const res = await query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users");
    return Number(res.rows[0].next_id);
  }
  if (name === "groups") {
    const res = await query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM groups");
    return Number(res.rows[0].next_id);
  }
  if (name === "admins") {
    const res = await query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM admins");
    return Number(res.rows[0].next_id);
  }
  return Date.now();
}

export async function closeDb() {
  // pool close is handled on process exit
}
