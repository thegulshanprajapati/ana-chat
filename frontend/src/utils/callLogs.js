const STORAGE_KEY = "anach_call_logs_v1";
const MAX_ITEMS = 120;

function safeParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadList() {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

function saveList(list) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  if (typeof window !== "undefined" && window.dispatchEvent) {
    window.dispatchEvent(new Event("anach_call_logs_updated"));
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getCallLogs() {
  return loadList();
}

export function clearCallLogs() {
  saveList([]);
}

export function appendCallLog(entry) {
  const list = loadList();
  const id = newId();
  const now = new Date().toISOString();
  const item = {
    id,
    created_at: now,
    ...entry
  };
  const next = [item, ...list].slice(0, MAX_ITEMS);
  saveList(next);
  return id;
}

export function patchCallLog(id, patch) {
  if (!id) return false;
  const list = loadList();
  const idx = list.findIndex((item) => item?.id === id);
  if (idx < 0) return false;
  const next = [...list];
  next[idx] = { ...next[idx], ...(patch || {}) };
  saveList(next);
  return true;
}
