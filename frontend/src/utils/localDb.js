const DB_NAME = "anachat_local_v1";
const DB_VERSION = 1;

function openLocalDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB is not supported on this browser"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains("chats")) {
        const chatStore = db.createObjectStore("chats", { keyPath: "id" });
        chatStore.createIndex("last_message_at", "last_message_at", { unique: false });
      }

      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("chat_id", "chat_id", { unique: false });
        msgStore.createIndex("created_at", "created_at", { unique: false });
        msgStore.createIndex("chat_created", ["chat_id", "created_at"], { unique: false });
      }

      if (!db.objectStoreNames.contains("reactions")) {
        db.createObjectStore("reactions", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("drafts")) {
        db.createObjectStore("drafts", { keyPath: "chat_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

export async function saveLocalChat(chat) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chats", "readwrite");
    const store = tx.objectStore("chats");
    const req = store.put(chat);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalChats() {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chats", "readonly");
    const store = tx.objectStore("chats");
    const req = store.getAll();
    req.onsuccess = () => {
      // Sort by last_message_at desc
      const sorted = (req.result || []).sort((a, b) => {
        return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
      });
      resolve(sorted);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalMessage(msg) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const req = store.put(msg);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalMessages(chatId) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("chat_id");
    const req = index.getAll(Number(chatId));

    req.onsuccess = () => {
      const sorted = (req.result || []).sort((a, b) => {
        return new Date(a.created_at) - new Date(b.created_at);
      });
      resolve(sorted);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalMessage(messageId) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const req = store.delete(messageId);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function clearLocalDb() {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["chats", "messages", "reactions", "drafts"], "readwrite");
    tx.objectStore("chats").clear();
    tx.objectStore("messages").clear();
    tx.objectStore("reactions").clear();
    tx.objectStore("drafts").clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Export database dump for backup
export async function exportLocalDbAsJson() {
  const db = await openLocalDb();
  const tx = db.transaction(["chats", "messages", "reactions", "drafts"], "readonly");
  
  const chats = await new Promise((res) => {
    tx.objectStore("chats").getAll().onsuccess = (e) => res(e.target.result);
  });
  const messages = await new Promise((res) => {
    tx.objectStore("messages").getAll().onsuccess = (e) => res(e.target.result);
  });
  const reactions = await new Promise((res) => {
    tx.objectStore("reactions").getAll().onsuccess = (e) => res(e.target.result);
  });
  const drafts = await new Promise((res) => {
    tx.objectStore("drafts").getAll().onsuccess = (e) => res(e.target.result);
  });

  return JSON.stringify({ chats, messages, reactions, drafts });
}

// Import database dump for restore
export async function importLocalDbFromJson(jsonString) {
  const data = JSON.parse(jsonString);
  const db = await openLocalDb();
  const tx = db.transaction(["chats", "messages", "reactions", "drafts"], "readwrite");

  if (data.chats) {
    const store = tx.objectStore("chats");
    data.chats.forEach((chat) => store.put(chat));
  }
  if (data.messages) {
    const store = tx.objectStore("messages");
    data.messages.forEach((msg) => store.put(msg));
  }
  if (data.reactions) {
    const store = tx.objectStore("reactions");
    data.reactions.forEach((r) => store.put(r));
  }
  if (data.drafts) {
    const store = tx.objectStore("drafts");
    data.drafts.forEach((d) => store.put(d));
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
