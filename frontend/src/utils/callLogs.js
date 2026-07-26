import { api } from "../api/client";

const STORAGE_KEY_PREFIX = "anach_call_logs_v1";
const MAX_ITEMS = 120;

function safeParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function keyForUser(userId) {
  const normalized = Number(userId);
  if (!normalized) return STORAGE_KEY_PREFIX;
  return `${STORAGE_KEY_PREFIX}_u${normalized}`;
}

function loadList(userId) {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeParse(localStorage.getItem(keyForUser(userId)));
  return Array.isArray(parsed) ? parsed : [];
}

function saveList(userId, list) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(keyForUser(userId), JSON.stringify(Array.isArray(list) ? list : []));
  if (typeof window !== "undefined" && window.dispatchEvent) {
    window.dispatchEvent(new Event("anach_call_logs_updated"));
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getCallLogs(userId) {
  return loadList(userId);
}

export function clearCallLogs(userId) {
  saveList(userId, []);
}

export function appendCallLog(userId, entry) {
  const list = loadList(userId);
  const id = newId();
  const now = new Date().toISOString();
  const item = {
    id,
    created_at: now,
    ...entry
  };
  const next = [item, ...list].slice(0, MAX_ITEMS);
  saveList(userId, next);
  
  // Also save to backend asynchronously
  try {
    api.post("/users/call-logs", {
      id,
      direction: entry.direction,
      status: entry.status,
      callType: entry.callType,
      mode: entry.mode,
      peerUserId: entry.peerUserId,
      peerName: entry.peerName,
      peerAvatar: entry.peerAvatar,
      chatId: entry.chatId,
      started_at: entry.started_at
    }).catch(() => {
      // Silently fail backend save, local storage is the primary
    });
  } catch {
    // Ignore backend errors
  }
  
  return id;
}

export function patchCallLog(userId, id, patch) {
  if (!id) return false;
  const list = loadList(userId);
  const idx = list.findIndex((item) => item?.id === id);
  if (idx < 0) return false;
  const next = [...list];
  next[idx] = { ...next[idx], ...(patch || {}) };
  saveList(userId, next);
  
  // Also update on backend
  try {
    if (patch?.status || patch?.ended_at) {
      api.patch(`/users/call-logs/${id}`, {
        status: patch.status,
        ended_at: patch.ended_at
      }).catch(() => {
        // Silently fail, local storage is primary
      });
    }
  } catch {
    // Ignore backend errors
  }
  
  return true;
}
