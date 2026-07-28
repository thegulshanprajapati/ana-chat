import { createClient } from "redis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const redisUrl = process.env.REDIS_URL || "";
let redisClient = null;
let useMock = false;

// Robust Mock Redis Client in case Redis server is not running
class MockRedisClient {
  constructor() {
    this.store = new Map();
    this.lists = new Map();
  }

  async connect() {
    console.log("[Redis] Running with In-Memory Mock Redis Client.");
    return this;
  }

  async disconnect() { }

  async hSet(key, field, value) {
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    this.store.get(key).set(field, value);
    return 1;
  }

  async hGet(key, field) {
    const map = this.store.get(key);
    return map ? map.get(field) : null;
  }

  async hDel(key, field) {
    const map = this.store.get(key);
    if (map) {
      map.delete(field);
      return 1;
    }
    return 0;
  }

  async hGetAll(key) {
    const map = this.store.get(key);
    if (!map) return {};
    const obj = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  async lPush(key, value) {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    this.lists.get(key).unshift(value); // push to head
    return this.lists.get(key).length;
  }

  async rPop(key) {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.pop(); // pop from tail
  }

  async lRange(key, start, stop) {
    const list = this.lists.get(key);
    if (!list) return [];
    const actualStop = stop === -1 ? list.length : stop + 1;
    return list.slice(start, actualStop);
  }

  async del(key) {
    let deleted = 0;
    if (this.store.delete(key)) deleted = 1;
    if (this.lists.delete(key)) deleted = 1;
    return deleted;
  }

  async set(key, value, options = {}) {
    this.store.set(key, value);
    return "OK";
  }

  async get(key) {
    return this.store.get(key) || null;
  }
}

if (redisUrl) {
  try {
    redisClient = createClient({ url: redisUrl });
    redisClient.on("error", (err) => {
      console.warn("[Redis] Client error, switching to mock:", err.message);
      useMock = true;
      redisClient = new MockRedisClient();
    });
    await redisClient.connect();
    console.log("[Redis] Connected to Redis server.");
  } catch (err) {
    console.error("[Redis] Initialization failed, using mock:", err.message);
    useMock = true;
    redisClient = new MockRedisClient();
    await redisClient.connect();
  }
} else {
  useMock = true;
  redisClient = new MockRedisClient();
  await redisClient.connect();
}

export { redisClient, useMock };
