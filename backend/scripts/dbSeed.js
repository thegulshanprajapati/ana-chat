import bcrypt from "bcryptjs";
import path from "node:path";
import dotenv from "dotenv";
import { getDb, getNextSequence } from "../src/db.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export async function runSeed() {
  const db = await getDb();

  const adminHash = await bcrypt.hash("Admin@12345", 10);
  await db.collection("admins").updateOne(
    { email: "admin@test.com" },
    {
      $set: {
        name: "System Admin",
        username: "admin",
        email: "admin@test.com",
        role: "super_admin",
        password_hash: adminHash,
        updated_at: new Date()
      },
      $setOnInsert: {
        id: await getNextSequence("admins"),
        created_at: new Date()
      }
    },
    { upsert: true }
  );

  const admin = await db.collection("admins").findOne({ email: "admin@test.com" });

  const demoPass = await bcrypt.hash("User@12345", 10);

  const users = [
    { name: "Demo One", email: "demo1@test.com", mobile: "9000000001" },
    { name: "Demo Two", email: "demo2@test.com", mobile: "9000000002" }
  ];

  const createdUserIds = [];
  for (const user of users) {
    await db.collection("users").updateOne(
      { email: user.email },
      {
        $set: {
          name: user.name,
          mobile: user.mobile,
          password_hash: demoPass,
          avatar_url: null,
          status: "offline",
          last_seen: new Date(),
          is_blocked: false,
          is_verified: true,
          updated_at: new Date()
        },
        $setOnInsert: {
          id: await getNextSequence("users"),
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    const savedUser = await db.collection("users").findOne({ email: user.email });
    createdUserIds.push(savedUser.id);
  }

  const [u1, u2] = createdUserIds;

  let chat = await db.collection("chats").findOne({
    chat_type: "direct",
    $or: [
      { user1_id: u1, user2_id: u2 },
      { user1_id: u2, user2_id: u1 }
    ]
  });

  let chatId;
  if (chat) {
    chatId = chat.id;
  } else {
    chatId = await getNextSequence("chats");
    await db.collection("chats").insertOne({
      id: chatId,
      user1_id: u1,
      user2_id: u2,
      chat_type: "direct",
      last_message_at: new Date(),
      created_by_user_id: admin.id
    });
    await db.collection("chat_members").insertMany([
      { chat_id: chatId, user_id: u1, role: "member", joined_at: new Date(), created_at: new Date() },
      { chat_id: chatId, user_id: u2, role: "member", joined_at: new Date(), created_at: new Date() }
    ]);
  }

  const msgExists = await db.collection("messages").findOne({ chat_id: chatId });
  if (!msgExists) {
    await db.collection("messages").insertMany([
      { id: await getNextSequence("messages"), chat_id: chatId, sender_id: u1, body: "Hello from seed message", image_url: null, seen: false, created_at: new Date(), updated_at: new Date() },
      { id: await getNextSequence("messages"), chat_id: chatId, sender_id: u2, body: "Admin-ready secure chat is live", image_url: null, seen: false, created_at: new Date(), updated_at: new Date() }
    ]);
  }

  console.log("Seed complete");
}

if (process.argv[1] && process.argv[1].endsWith("dbSeed.js")) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed", err);
      process.exit(1);
    });
}
