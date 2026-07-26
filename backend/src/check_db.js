import { MongoClient } from "mongodb";
import fs from "fs";

const uri = "mongodb+srv://anachat:anachat123@cluster0.ylyxc5r.mongodb.net/anachat?retryWrites=true&w=majority";
const dbName = "anachat";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const admins = await db.collection("admins").find({}).toArray();
    const users = await db.collection("users").find({}).project({ password_hash: 0 }).toArray();

    fs.writeFileSync("db_dump.json", JSON.stringify({ admins, users }, null, 2), "utf-8");
    console.log("Dump written successfully to db_dump.json");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();
