import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContextNew";
import { useTheme } from "../context/ThemeContext";
import {
  decryptTextFromMessage,
  encryptOutgoingMessage,
  getOrCreateRsaKeyPair,
  reencryptAesKeyForRecipients
} from "../utils/e2ee";
import SidebarPanel from "../components/sidebar/SidebarPanel";
import ChatPane from "../components/chat/ChatPane";
import CallsPanel from "../components/panels/CallsPanel";
import StatusPanel from "../components/panels/StatusPanel";
import ProfileDrawer from "../components/common/ProfileDrawer";
import SettingsDrawer from "../components/common/SettingsDrawer";
import ToastStack from "../components/common/ToastStack";
import CallOverlay from "../components/chat/CallOverlay";
import CallLogsDrawer from "../components/chat/CallLogsDrawer";
import CreateGroupModal from "../components/common/CreateGroupModal";
import { appendCallLog, patchCallLog } from "../utils/callLogs";
import { navigateTo } from "../utils/nav";

const IDLE_CALL = {
  phase: "idle",
  callType: "voice",
  peerUserId: null,
  peerName: "",
  peerAvatar: null,
  chatId: null,
  micEnabled: true,
  videoEnabled: true,
  screenSharing: false,
  mode: "standard",
  startedAt: null,
  logId: null
};

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
const DEFAULT_UI_SETTINGS = {
  compactMode: true,
  showOnlineStatus: true,
  enterToSend: true,
  soundEffects: true,
  notificationsEnabled: true
};
const CHAT_PIN_PATTERN = /^\d{4,8}$/;
const RECIPIENT_CACHE_TTL_MS = 2 * 60 * 1000;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

function mediaAccessErrorMessage(error, callType = "voice") {
  const needs = callType === "video" ? "camera and microphone" : "microphone";
  const name = (error?.name || "").toString();
  const raw = (error?.message || "").toString().trim();
  const message = raw.toLowerCase();

  if (!navigator?.mediaDevices?.getUserMedia) {
    return "This browser does not support voice/video calls.";
  }
  if (!window.isSecureContext) {
    return "Calls require HTTPS (or localhost). Open the app on a secure origin and retry.";
  }
  if (
    name === "NotAllowedError"
    || name === "PermissionDeniedError"
    || message.includes("permission denied")
    || message.includes("denied by system")
  ) {
    return `Permission denied. Allow ${needs} in browser site settings and Windows Privacy settings, then retry.`;
  }
  if (name === "NotFoundError" || message.includes("requested device not found")) {
    return `No ${callType === "video" ? "camera/microphone" : "microphone"} device found.`;
  }
  if (name === "NotReadableError" || message.includes("device in use")) {
    return `${callType === "video" ? "Camera/microphone" : "Microphone"} is busy in another app. Close other app and retry.`;
  }
  return raw || "Unable to access media device.";
}

function sortChats(list) {
  return [...list].sort((a, b) => {
    const aPriority = a?.chat_type === "self" ? 0 : 1;
    const bPriority = b?.chat_type === "self" ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const left = new Date(b.last_message_at || b.last_message_created_at || 0).getTime();
    const right = new Date(a.last_message_at || a.last_message_created_at || 0).getTime();
    return left - right;
  });
}

function createClientMessageId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const PINNED_CHATS_STORAGE_KEY = "ana_pinned_chats_v1";

export default function ChatPage() {
  const { user, logout, reload } = useAuth();
  const socket = useSocket();
  const {
    theme,
    toggleTheme,
    accentColor,
    setAccentColor,
    doodleStyle,
    setDoodleStyle,
    sidebarColor,
    chatPaneColor,
    setSidebarColor,
    setChatPaneColor,
    isSidebarLight,
    isChatPaneLight
  } = useTheme();
  const isMobile = useIsMobile();

  // Safety: ChatPage should not crash if auth state flips to null mid-render.
  if (!user?.id) return null;

  const sidebarTabStorageKey = useMemo(() => `anach_sidebar_tab_v1_${user?.id || "guest"}`, [user?.id]);
  const [activeSidebarTab, setActiveSidebarTab] = useState(() => {
    try {
      const stored = (window.localStorage.getItem(`anach_sidebar_tab_v1_${user?.id || "guest"}`) || "").toString();
      if (stored === "status" || stored === "calls" || stored === "chats") return stored;
    } catch {
      // ignore
    }
    return "chats";
  });

  const [chats, setChats] = useState([]);
  const [hiddenChats, setHiddenChats] = useState([]);
  const [hiddenChatsCount, setHiddenChatsCount] = useState(0);
  const [pinnedChatIds, setPinnedChatIds] = useState(() => {
    try {
      const raw = localStorage.getItem(PINNED_CHATS_STORAGE_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter(Boolean) : [];
    } catch {
      return [];
    }
  });
  const [chatPinCache, setChatPinCache] = useState("");
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeChat, setActiveChat] = useState(null);
  const [selectedStatusFeed, setSelectedStatusFeed] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingName, setTypingName] = useState("");
  const [search, setSearch] = useState("");
  const [peopleResults, setPeopleResults] = useState([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [unreadByChat, setUnreadByChat] = useState({});
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callLogsOpen, setCallLogsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupUsers, setGroupUsers] = useState([]);
  const [groupUsersLoading, setGroupUsersLoading] = useState(false);
  const [groupCreating, setGroupCreating] = useState(false);
  const [blockActionBusy, setBlockActionBusy] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState({});
  const [modalConfig, setModalConfig] = useState(null);
  const [userSettings, setUserSettings] = useState({
    ...DEFAULT_UI_SETTINGS
  });
  const [toasts, setToasts] = useState([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      const key = (e.key || "").toLowerCase();

      // 1. Disable browser defaults for Ctrl+P, Ctrl+S, Ctrl+F, Ctrl+D on main page
      if (ctrl && !alt) {
        if (key === "p" || key === "s" || key === "f" || key === "d") {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 2. Escape key handling
      if (e.key === "Escape") {
        setReplyToMessage(null);
        setSettingsOpen(false);
        setProfileOpen(false);
        setGroupModalOpen(false);
        setCallLogsOpen(false);
      }

      // 3. Global hotkeys (Ctrl + Alt + [Letter])
      if (ctrl && alt) {
        if (key === "s") {
          e.preventDefault();
          setSettingsOpen((prev) => !prev);
        } else if (key === "p") {
          e.preventDefault();
          setProfileOpen((prev) => !prev);
        } else if (key === "n") {
          e.preventDefault();
          setGroupModalOpen((prev) => !prev);
        } else if (key === "a") {
          e.preventDefault();
          toggleTheme?.();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, [toggleTheme]);

  const [call, setCall] = useState(IDLE_CALL);
  const [localCallStream, setLocalCallStream] = useState(null);
  const [remoteCallStream, setRemoteCallStream] = useState(null);
  const [watchSessions, setWatchSessions] = useState({});

  const activeChatIdRef = useRef(null);
  const callRef = useRef(IDLE_CALL);
  const callLogIdRef = useRef(null);
  const chatsRef = useRef([]);
  const peerRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const audioSenderRef = useRef(null);
  const videoSenderRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  const deliveredMessageIdsRef = useRef(new Set());
  const typingTimer = useRef(null);
  const toastTimers = useRef(new Map());
  const settingsRef = useRef(userSettings);
  const chatRecipientsCacheRef = useRef(new Map());
  const chatUpdatedTimerRef = useRef(null);
  const lastChatMessageEventAtRef = useRef(new Map());

  const notify = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random()}`;
    const normalized = { id, type: "info", ...toast };
    setToasts((prev) => [...prev, normalized]);

    const notificationOn = settingsRef.current.notificationsEnabled !== false;
    const soundOn = settingsRef.current.soundEffects !== false;
    if (notificationOn && soundOn) {
      playMessageTone(normalized.type);
    }

    // Show browser notification for priority notifications (calls, messages) even if tab is visible
    // This ensures user doesn't miss important notifications
    const isPriorityNotification = toast?.isPriority === true;
    if (
      notificationOn
      && typeof Notification !== "undefined"
      && Notification.permission === "granted"
      && typeof document !== "undefined"
      && (isPriorityNotification || document.visibilityState !== "visible")
    ) {
      const title = normalized.title || "Secure Chat";
      const body = normalized.message || "";
      if (body) {
        const notification = new Notification(title, {
          body,
          badge: "/logo.png",
          tag: isPriorityNotification ? "priority-notification" : undefined // Replace previous notifications
        });
        // Auto-close notification after 5 seconds for non-priority, 10 seconds for priority
        setTimeout(() => notification.close(), isPriorityNotification ? 10000 : 5000);
      }
    }

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((entry) => entry.id !== id));
      toastTimers.current.delete(id);
    }, 3600);
    toastTimers.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const merged = {
      ...DEFAULT_UI_SETTINGS,
      ...(user?.settings || {}),
      compactMode: true
    };
    setUserSettings(merged);
  }, [user?.settings]);

  useEffect(() => {
    if (!user?.id) return;
    if (user?.anaSecurityPinEnabled) return;
    try {
      const key = `anach_ana_security_prompt_dismissed_v1_${user.id}`;
      const dismissed = window.localStorage.getItem(key) === "1";
      if (!dismissed) {
        setSettingsOpen(true);
        window.localStorage.setItem(key, "1");
        notify({ type: "info", title: "Ana Security", message: "Set a device PIN to protect new-device logins." });
      }
    } catch {
      // ignore storage failures
    }
  }, [notify, user?.anaSecurityPinEnabled, user?.id]);

  // Request notification permission on first load
  useEffect(() => {
    if (!user?.id) return;
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {
          // Ignore permission errors
        });
      }
    } catch {
      // Ignore browser notification errors
    }
  }, [user?.id]);

  useEffect(() => {
    settingsRef.current = userSettings;
  }, [userSettings]);

  useEffect(() => {
    const raw = socket?.raw;
    if (!raw) return undefined;

    const onNotify = (payload = {}) => {
      const title = payload.title || "Notification";
      const message = payload.message || "";
      if (message) notify({ type: "info", title, message });
    };

    const onBroadcast = (payload = {}) => {
      const title = payload.title || "Announcement";
      const message = payload.message || "";
      if (message) notify({ type: "info", title, message });
    };

    raw.on("admin_notification", onNotify);
    raw.on("admin_broadcast", onBroadcast);
    return () => {
      raw.off("admin_notification", onNotify);
      raw.off("admin_broadcast", onBroadcast);
    };
  }, [notify, socket?.raw]);

  useEffect(() => {
    activeChatIdRef.current = activeChat?.id || null;
  }, [activeChat?.id]);

  useEffect(() => {
    setSelectedMessageIds({});
    setReplyToMessage(null);
    setTyping(false);
    setTypingName("");
    clearTimeout(typingTimer.current);
  }, [activeChat?.id]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const decryptMessageForMe = useCallback(async (message) => {
    if (!message) return message;
    const pair = await getOrCreateRsaKeyPair(user.id);

    let body = typeof message.body === "string" ? message.body : null;
    if ((!body || body.length === 0) && message.e2ee?.key && message.e2ee?.text) {
      try {
        body = await decryptTextFromMessage({ e2ee: message.e2ee, privateJwk: pair.privateJwk });
      } catch {
        body = null;
      }
    }

    let replyBody = typeof message.reply_to_body === "string" ? message.reply_to_body : null;
    if ((!replyBody || replyBody.length === 0) && message.reply_to_e2ee?.key && message.reply_to_e2ee?.text) {
      try {
        replyBody = await decryptTextFromMessage({ e2ee: message.reply_to_e2ee, privateJwk: pair.privateJwk });
      } catch {
        replyBody = null;
      }
    }

    return {
      ...message,
      body: body != null ? body : null,
      reply_to_body: replyBody != null ? replyBody : null
    };
  }, [user.id]);

  const getChatRecipients = useCallback(async (chatId) => {
    const normalizedChatId = Number(chatId);
    if (!normalizedChatId) return [];

    const now = Date.now();
    const cached = chatRecipientsCacheRef.current.get(normalizedChatId);
    let list = cached?.participants || [];

    if (!cached || !cached.fetchedAt || now - cached.fetchedAt > RECIPIENT_CACHE_TTL_MS) {
      const { data } = await api.get(`/chats/${normalizedChatId}/participants`);
      list = Array.isArray(data?.participants) ? data.participants : [];
      chatRecipientsCacheRef.current.set(normalizedChatId, { fetchedAt: now, participants: list });
    }

    const pair = await getOrCreateRsaKeyPair(user.id);

    const recipients = list.map((entry) => ({
      id: entry.id,
      publicKey: entry.id === user.id ? pair.publicJwk : entry.publicKey
    }));

    const missing = recipients.find((entry) => !entry.publicKey);
    if (missing) {
      const err = new Error("Recipient has not set up encryption keys yet. Ask them to login once and retry.");
      err.code = "E2EE_KEY_MISSING";
      throw err;
    }

    return recipients;
  }, [user.id]);

  const decryptChatPreviewForMe = useCallback(async (chat) => {
    if (!chat || chat.last_message_body) return chat;
    if (!chat.last_message_e2ee?.key || !chat.last_message_e2ee?.text) return chat;
    try {
      const pair = await getOrCreateRsaKeyPair(user.id);
      const preview = await decryptTextFromMessage({ e2ee: chat.last_message_e2ee, privateJwk: pair.privateJwk });
      return { ...chat, last_message_body: preview || "" };
    } catch {
      return chat;
    }
  }, [user.id]);

  const loadMessages = useCallback(async (chatId) => {
    if (!chatId) return;
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/messages/${chatId}`);
      const list = Array.isArray(data) ? data : [];
      const decrypted = await Promise.all(list.map((msg) => decryptMessageForMe(msg)));
      setMessages(decrypted);
      setUnreadByChat((prev) => ({ ...prev, [chatId]: 0 }));
      return true;
    } catch {
      setMessages([]);
      notify({ type: "error", message: "Unable to load messages." });
      return false;
    } finally {
      setLoadingMessages(false);
    }
  }, [decryptMessageForMe, notify]);

  const refreshActiveChatMessages = useCallback(async () => {
    if (!activeChatIdRef.current) return;
    const ok = await loadMessages(activeChatIdRef.current);
    if (ok) {
      notify({ type: "success", message: "Messages refreshed." });
    }
  }, [loadMessages, notify]);

  const applyMessagePatch = useCallback((messageId, patch) => {
    setMessages((prev) => prev.map((item) => (
      String(item.id) === String(messageId)
        ? {
            ...item,
            ...(typeof patch === "function" ? patch(item) : patch)
          }
        : item
    )));
  }, []);

  const saveUiSettings = useCallback(async (nextSettings) => {
    setSettingsSaving(true);
    try {
      if (
        nextSettings.notificationsEnabled
        && typeof Notification !== "undefined"
        && Notification.permission === "default"
      ) {
        try {
          await Notification.requestPermission();
        } catch {
          // ignore permission prompt failures
        }
      }

      const { data } = await api.patch("/users/me/settings", { settings: nextSettings });
      const merged = {
        ...DEFAULT_UI_SETTINGS,
        ...(data?.settings || nextSettings),
        compactMode: true
      };
      setUserSettings(merged);
      notify({ type: "success", message: "Settings saved." });
      await reload();
      setSettingsOpen(false);
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to save settings."
      });
    } finally {
      setSettingsSaving(false);
    }
  }, [notify, reload]);

  const selectChat = useCallback(async (chat) => {
    if (!chat) return;
    if (activeChat?.id !== chat.id) {
      setMessages([]);
      setTyping(false);
      setTypingName("");
    }
    setActiveChat(chat);
    await loadMessages(chat.id);
    void getChatRecipients(chat.id).catch(() => {});
    socket?.emit("join_room", chat.id);
    socket?.emit("seen", { chatId: chat.id });
    if (isMobile) setMobileChatOpen(true);
  }, [activeChat?.id, getChatRecipients, isMobile, loadMessages, socket]);

  const loadChats = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoadingChats(true);
    try {
      const [{ data }, { data: hiddenCountData }] = await Promise.all([
        api.get("/chats"),
        api.get("/chats/hidden/count")
      ]);
      const list = sortChats(Array.isArray(data) ? data : []);
      const decryptedList = await Promise.all(list.map((chat) => decryptChatPreviewForMe(chat)));
      setChats(decryptedList);
      const nextHiddenCount = Number(hiddenCountData?.count || 0);
      setHiddenChatsCount(nextHiddenCount);
      if (!nextHiddenCount) {
        setHiddenChats([]);
        setChatPinCache("");
      }

      if (!decryptedList.length) {
        setActiveChat(null);
        setMessages([]);
        return;
      }

      const activeId = activeChatIdRef.current;
      if (!activeId) {
        return;
      }

      const stillActive = decryptedList.find((item) => item.id === activeId);
      if (stillActive) {
        setActiveChat((prev) => (prev?.id === stillActive.id ? { ...prev, ...stillActive } : stillActive));
      } else {
        setActiveChat(null);
      }
    } catch (err) {
      if (err?.name === "CanceledError" || err?.message === "canceled" || err?.code === "ERR_CANCELED") {
        return; // Ignore canceled duplicate requests
      }
      setChats([]);
      setHiddenChats([]);
      setChatPinCache("");
      setHiddenChatsCount(0);
      notify({ type: "error", message: "Unable to load chats." });
    } finally {
      setLoadingChats(false);
    }
  }, [decryptChatPreviewForMe, isMobile, notify, selectChat]);

  const createChat = useCallback(async (otherUserId) => {
    try {
      const { data } = await api.post("/chats", { otherUserId });
      const { data: latest } = await api.get("/chats");
      const list = sortChats(Array.isArray(latest) ? latest : []);
      const decryptedList = await Promise.all(list.map((chat) => decryptChatPreviewForMe(chat)));
      setChats(decryptedList);
      const target = decryptedList.find((chat) => chat.id === data?.id) || decryptedList[0];
      if (target) await selectChat(target);
    } catch (err) {
      notify({ type: "error", message: err.response?.data?.message || "Unable to start chat." });
    }
  }, [decryptChatPreviewForMe, notify, selectChat]);

  const openGroupCreator = useCallback(async () => {
    setGroupModalOpen(true);
    setGroupUsersLoading(true);
    try {
      const { data } = await api.get("/users", { params: { q: "" } });
      setGroupUsers(Array.isArray(data) ? data : []);
    } catch {
      setGroupUsers([]);
      notify({ type: "error", message: "Unable to load users for group." });
    } finally {
      setGroupUsersLoading(false);
    }
  }, [notify]);

  const createGroup = useCallback(async ({ name, memberIds }) => {
    setGroupCreating(true);
    try {
      const { data } = await api.post("/chats/group", { name, memberIds });
      const createdChatId = Number(data?.id);
      const { data: latest } = await api.get("/chats");
      const list = sortChats(Array.isArray(latest) ? latest : []);
      const decryptedList = await Promise.all(list.map((chat) => decryptChatPreviewForMe(chat)));
      setChats(decryptedList);

      const target = decryptedList.find((chat) => Number(chat.id) === createdChatId) || decryptedList[0];
      if (target) await selectChat(target);
      setGroupModalOpen(false);
      notify({ type: "success", message: "Group created." });
    } catch (err) {
      notify({ type: "error", message: err.response?.data?.message || "Unable to create group." });
    } finally {
      setGroupCreating(false);
    }
  }, [decryptChatPreviewForMe, notify, selectChat]);

  const unlockHiddenChatsWithPin = useCallback(async (rawPin, { silent = false } = {}) => {
    const pin = (rawPin || "").toString().trim();
    if (!CHAT_PIN_PATTERN.test(pin)) {
      if (!silent) notify({ type: "error", message: "PIN must be 4 to 8 digits." });
      return { ok: false };
    }

    try {
      const { data } = await api.post("/chats/hidden/unlock", { pin });
      const list = sortChats(Array.isArray(data?.chats) ? data.chats : []);
      const decryptedList = await Promise.all(list.map((chat) => decryptChatPreviewForMe(chat)));
      setHiddenChats(decryptedList);
      setHiddenChatsCount(decryptedList.length);
      setChatPinCache(pin);
      if (!silent) {
        notify({ type: "success", message: decryptedList.length ? "Hidden chats unlocked." : "No hidden chats found." });
      }
      return { ok: true, list: decryptedList };
    } catch (err) {
      if (!silent) {
        notify({
          type: "error",
          message: err.response?.data?.message || "Unable to unlock hidden chats."
        });
      }
      return { ok: false };
    }
  }, [decryptChatPreviewForMe, notify]);

  const hideActiveChat = useCallback(async () => {
    if (!activeChat?.id) return;
    if (activeChat.chat_type === "self") {
      notify({ type: "info", message: "AnaLocker chat cannot be hidden." });
      return;
    }

    setModalConfig({
      type: "prompt",
      title: "Set Chat PIN",
      message: "Enter 4-8 digit PIN. First time PIN will be set for hidden chats.",
      placeholder: "Enter PIN",
      isPassword: true,
      onConfirm: async (pinInput) => {
        const pin = (pinInput || "").trim();
        if (!pin) return;
        try {
          const { data } = await api.post(`/chats/${activeChat.id}/hide`, { pin });
          if (data?.pin_created) {
            notify({ type: "success", message: "Chat hidden. PIN created successfully." });
          } else {
            notify({ type: "success", message: "Chat hidden with PIN." });
          }
          await unlockHiddenChatsWithPin(pin, { silent: true });
          await loadChats();
        } catch (err) {
          notify({
            type: "error",
            message: err.response?.data?.message || "Unable to hide chat."
          });
        }
      }
    });
  }, [activeChat, loadChats, notify, unlockHiddenChatsWithPin]);

  const unhideChat = useCallback(async (chatId) => {
    const targetChatId = Number(chatId);
    if (!targetChatId) return;

    const performUnhide = async (pinValue) => {
      try {
        await api.post(`/chats/${targetChatId}/unhide`, { pin: pinValue });
        await unlockHiddenChatsWithPin(pinValue, { silent: true });
        notify({ type: "success", message: "Chat unhidden." });
        await loadChats();
      } catch (err) {
        setChatPinCache("");
        notify({
          type: "error",
          message: err.response?.data?.message || "Unable to unhide chat."
        });
      }
    };

    let pin = chatPinCache;
    if (!pin) {
      setModalConfig({
        type: "prompt",
        title: "Unhide Chat",
        message: "Enter chat PIN to unhide this chat",
        placeholder: "Enter PIN",
        isPassword: true,
        onConfirm: (pinInput) => {
          const pinVal = (pinInput || "").trim();
          if (!pinVal) return;
          performUnhide(pinVal);
        }
      });
    } else {
      await performUnhide(pin);
    }
  }, [chatPinCache, loadChats, notify, unlockHiddenChatsWithPin]);

  const setAndPersistPinnedChatIds = useCallback((updater) => {
    setPinnedChatIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const normalized = Array.isArray(next) ? next.map((id) => Number(id)).filter(Boolean) : [];
      try {
        localStorage.setItem(PINNED_CHATS_STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // ignore
      }
      return normalized;
    });
  }, []);

  const togglePinChat = useCallback((chatId) => {
    const id = Number(chatId);
    if (!id) return;
    setAndPersistPinnedChatIds((prev) => {
      const set = new Set((prev || []).map((v) => Number(v)).filter(Boolean));
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }, [setAndPersistPinnedChatIds]);

  const hideChatById = useCallback(async (chatId) => {
    const id = Number(chatId);
    if (!id) return;

    const target = chatsRef.current.find((c) => Number(c.id) === id) || null;
    if (target?.chat_type === "self") {
      notify({ type: "info", message: "AnaLocker chat cannot be hidden." });
      return;
    }

    setModalConfig({
      type: "prompt",
      title: "Set Chat PIN",
      message: "Enter 4-8 digit PIN. First time PIN will be set for hidden chats.",
      placeholder: "Enter PIN",
      isPassword: true,
      onConfirm: async (pinInput) => {
        const pin = (pinInput || "").trim();
        if (!pin) return;
        try {
          const { data } = await api.post(`/chats/${id}/hide`, { pin });
          if (data?.pin_created) notify({ type: "success", message: "Chat hidden. PIN created successfully." });
          else notify({ type: "success", message: "Chat hidden with PIN." });
          await unlockHiddenChatsWithPin(pin, { silent: true });
          await loadChats();
        } catch (err) {
          notify({
            type: "error",
            message: err.response?.data?.message || "Unable to hide chat."
          });
        }
      }
    });
  }, [loadChats, notify, unlockHiddenChatsWithPin]);

  const deleteChatById = useCallback(async (chatId) => {
    const id = Number(chatId);
    if (!id) return;
    const target = chatsRef.current.find((c) => Number(c.id) === id) || null;
    if (target?.chat_type === "self") {
      notify({ type: "info", message: "AnaLocker chat cannot be deleted." });
      return;
    }

    setModalConfig({
      type: "confirm",
      title: "Delete Chat",
      message: "Are you sure you want to permanently delete this chat? This will clear all messages and remove it from your chat list.",
      onConfirm: async () => {
        try {
          await api.delete(`/chats/${id}`);
          notify({ type: "success", message: "Chat deleted successfully." });
          if (Number(activeChat?.id) === id) {
            setActiveChat(null);
          }
          await loadChats();
        } catch (err) {
          notify({
            type: "error",
            message: err.response?.data?.message || "Unable to delete chat."
          });
        }
      }
    });
  }, [activeChat?.id, loadChats, notify]);

  const updateBlockStateForUser = useCallback((targetUserId, blockedByMe) => {
    if (!targetUserId) return;
    const nextValue = blockedByMe ? 1 : 0;
    setChats((prev) => prev.map((chat) => {
      if (chat.chat_type === "group") return chat;
      if (Number(chat.other_user_id) !== Number(targetUserId)) return chat;
      return { ...chat, blocked_by_me: nextValue };
    }));
    setActiveChat((prev) => {
      if (!prev || prev.chat_type === "group") return prev;
      if (Number(prev.other_user_id) !== Number(targetUserId)) return prev;
      return { ...prev, blocked_by_me: nextValue };
    });
  }, []);

  const blockActiveUser = useCallback(() => {
    const targetUserId = Number(activeChat?.other_user_id);
    if (!targetUserId || activeChat?.chat_type === "group" || activeChat?.chat_type === "self" || blockActionBusy) return;
    setModalConfig({
      type: "confirm",
      title: "Block User",
      message: "Block this user? You will not be able to send messages or calls until you unblock.",
      onConfirm: async () => {
        setBlockActionBusy(true);
        try {
          await api.post(`/users/${targetUserId}/block`);
          updateBlockStateForUser(targetUserId, true);
          notify({ type: "success", message: "User blocked." });
        } catch (err) {
          notify({
            type: "error",
            message: err.response?.data?.message || "Unable to block user."
          });
        } finally {
          setBlockActionBusy(false);
        }
      }
    });
  }, [activeChat?.chat_type, activeChat?.other_user_id, blockActionBusy, notify, updateBlockStateForUser]);

  const unblockActiveUser = useCallback(async () => {
    const targetUserId = Number(activeChat?.other_user_id);
    if (!targetUserId || activeChat?.chat_type === "group" || activeChat?.chat_type === "self" || blockActionBusy) return;
    setBlockActionBusy(true);
    try {
      await api.delete(`/users/${targetUserId}/block`);
      updateBlockStateForUser(targetUserId, false);
      notify({ type: "success", message: "User unblocked." });
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to unblock user."
      });
    } finally {
      setBlockActionBusy(false);
    }
  }, [activeChat?.chat_type, activeChat?.other_user_id, blockActionBusy, notify, updateBlockStateForUser]);

  const reportUser = useCallback(async ({ userId, reason, details }) => {
    const targetUserId = Number(userId);
    if (!targetUserId) return;
    try {
      await api.post(`/users/${targetUserId}/report`, {
        reason,
        details
      });
      notify({ type: "success", message: "Report submitted. Our team will review it." });
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to submit report."
      });
      throw err;
    }
  }, [notify]);

  const setChatBackground = useCallback(async ({ preset, file }) => {
    const chatId = Number(activeChatIdRef.current);
    if (!chatId) return;

    const form = new FormData();
    if (preset) form.append("backgroundPreset", preset);
    if (file) form.append("background", file);
    if (!preset && !file) return;

    try {
      const { data } = await api.patch(`/chats/${chatId}/background`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const nextBackground = data?.chat_background_url || null;
      setChats((prev) => prev.map((chat) => (
        Number(chat.id) === chatId ? { ...chat, chat_background_url: nextBackground } : chat
      )));
      setActiveChat((prev) => (
        prev && Number(prev.id) === chatId ? { ...prev, chat_background_url: nextBackground } : prev
      ));
      notify({ type: "success", message: "Chat background updated." });
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to update chat background."
      });
      throw err;
    }
  }, [notify]);

  const clearChatBackground = useCallback(async () => {
    const chatId = Number(activeChatIdRef.current);
    if (!chatId) return;
    try {
      const { data } = await api.patch(`/chats/${chatId}/background`, { clear: true });
      const nextBackground = data?.chat_background_url || null;
      setChats((prev) => prev.map((chat) => (
        Number(chat.id) === chatId ? { ...chat, chat_background_url: nextBackground } : chat
      )));
      setActiveChat((prev) => (
        prev && Number(prev.id) === chatId ? { ...prev, chat_background_url: nextBackground } : prev
      ));
      notify({ type: "success", message: "Chat background removed." });
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to reset chat background."
      });
      throw err;
    }
  }, [notify]);

  const sendMessage = useCallback(async ({ body, media, replyToMessageId }) => {
    if (!activeChat?.id) return;
    if (activeChat.chat_type !== "group") {
      if (activeChat.blocked_by_me) {
        const error = new Error("You blocked this user. Unblock to send messages.");
        error.response = { data: { message: error.message } };
        throw error;
      }
      if (activeChat.blocked_me) {
        const error = new Error("This user blocked you. Message cannot be sent.");
        error.response = { data: { message: error.message } };
        throw error;
      }
    }
    const clientMessageId = createClientMessageId();
    const replyTarget = replyToMessageId
      ? (messages.find((item) => Number(item.id) === Number(replyToMessageId)) || replyToMessage)
      : null;
    const replySenderName = replyTarget
      ? (replyTarget.sender_name
        || (Number(replyTarget.sender_id) === Number(user.id) ? "You" : (activeChat.other_user_name || "User")))
      : null;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = {
      id: tempId,
      chat_id: activeChat.id,
      sender_id: user.id,
      client_message_id: clientMessageId,
      body: body || null,
      image_url: null,
      reply_to_message_id: replyTarget?.id || null,
      reply_to_sender_id: replyTarget?.sender_id || null,
      reply_to_sender_name: replySenderName,
      reply_to_body: replyTarget?.body || null,
      reply_to_image_url: replyTarget?.image_url || null,
      reply_to_deleted_for_everyone: Boolean(replyTarget?.deleted_for_everyone),
      seen: 0,
      delivery_status: "sending",
      created_at: new Date().toISOString(),
      pending: true
    };

    setMessages((prev) => [...prev, optimistic]);
    setChats((prev) => sortChats(prev.map((chat) => (
      chat.id === activeChat.id
        ? {
            ...chat,
            last_message_at: optimistic.created_at,
            last_message_body: body || (media ? "[media]" : ""),
            last_message_image: media ? "media" : null
          }
        : chat
    ))));

    const form = new FormData();
    form.append("chatId", String(activeChat.id));
    form.append("clientMessageId", clientMessageId);
    if (replyTarget?.id) form.append("replyToMessageId", String(replyTarget.id));

    try {
      const recipients = await getChatRecipients(activeChat.id);
      const { e2ee, encryptedFile } = await encryptOutgoingMessage({
        plaintext: body || "",
        file: media || null,
        recipients
      });

      form.append("e2ee", JSON.stringify(e2ee));
      if (encryptedFile) {
        form.append("media", encryptedFile, "encrypted.bin");
      }

      const { data } = await api.post("/messages", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const decryptedData = await decryptMessageForMe(data);

      setMessages((prev) => {
        const replaced = prev.map((msg) => (msg.id === tempId ? { ...decryptedData, delivery_status: "sent" } : msg));
        return replaced.some((msg) => msg.id === decryptedData.id) ? replaced : [...replaced, { ...decryptedData, delivery_status: "sent" }];
      });
      setChats((prev) => sortChats(prev.map((chat) => (
        chat.id === activeChat.id
          ? {
              ...chat,
              last_message_at: decryptedData.created_at,
              last_message_body: decryptedData.body,
              last_message_image: decryptedData.image_url
            }
          : chat
      ))));
      setReplyToMessage(null);
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      throw err;
    }
  }, [activeChat, decryptMessageForMe, getChatRecipients, messages, replyToMessage, user?.id]);

  const sendCallChatMessage = useCallback(async (text) => {
    const chatId = callRef.current.chatId || activeChatIdRef.current;
    const body = (text || "").trim();
    if (!chatId || !body) return;
    const chat = chatsRef.current.find((item) => Number(item.id) === Number(chatId));
    if (chat?.chat_type !== "group") {
      if (chat?.blocked_by_me) {
        notify({ type: "info", message: "You blocked this user. Unblock to send messages." });
        return;
      }
      if (chat?.blocked_me) {
        notify({ type: "info", message: "This user blocked you. Message cannot be sent." });
        return;
      }
    }
    const clientMessageId = createClientMessageId();

    const form = new FormData();
    form.append("chatId", String(chatId));
    form.append("clientMessageId", clientMessageId);

    let data;
    try {
      const recipients = await getChatRecipients(chatId);
      const { e2ee } = await encryptOutgoingMessage({
        plaintext: body,
        file: null,
        recipients
      });
      form.append("e2ee", JSON.stringify(e2ee));

      const response = await api.post("/messages", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      data = await decryptMessageForMe(response.data);
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to send chat message in call."
      });
      throw err;
    }

    if (chatId === activeChatIdRef.current) {
      setMessages((prev) => (
        prev.some((item) => String(item.id) === String(data.id))
          ? prev
          : [...prev, data]
      ));
    }

    setChats((prev) => sortChats(prev.map((chat) => (
      chat.id === chatId
        ? {
            ...chat,
            last_message_at: data.created_at,
            last_message_body: data.body,
            last_message_image: data.image_url
          }
        : chat
    ))));
  }, [decryptMessageForMe, getChatRecipients, notify]);

  const removeLocalMessage = useCallback(async (message) => {
    if (!message?.id) return;
    try {
      await api.post(`/messages/${message.id}/delete-for-me`);
      setMessages((prev) => prev.filter((item) => item.id !== message.id));
      notify({ type: "success", message: "Message deleted for you." });
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to delete message."
      });
    }
  }, [notify]);

  const editMessage = useCallback(async (message, nextBody) => {
    if (!message?.id) return;
    const text = (nextBody || "").trim();
    if (!text || text === (message.body || "").trim()) return;
    try {
      const chatId = Number(message.chat_id);
      if (!chatId) throw new Error("chat_id missing on message");

      const recipients = await getChatRecipients(chatId);
      const { e2ee } = await encryptOutgoingMessage({ plaintext: text, file: null, recipients });

      const { data } = await api.patch(`/messages/${message.id}/edit`, { e2ee });
      const decrypted = await decryptMessageForMe(data);
      applyMessagePatch(message.id, decrypted);
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to edit message."
      });
    }
  }, [applyMessagePatch, decryptMessageForMe, getChatRecipients, notify]);

  const deleteForEveryone = useCallback(async (message) => {
    if (!message?.id) return;
    try {
      await api.post(`/messages/${message.id}/delete-for-everyone`);
      applyMessagePatch(message.id, {
        body: null,
        image_url: null,
        e2ee: null,
        deleted_for_everyone: true
      });
      notify({ type: "success", message: "Message deleted for everyone." });
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to delete for everyone."
      });
    }
  }, [applyMessagePatch, notify]);

  const toggleStarMessage = useCallback(async (message) => {
    if (!message?.id) return;
    const nextStarred = !message.my_starred;
    try {
      await api.post(`/messages/${message.id}/star`, { starred: nextStarred });
      applyMessagePatch(message.id, { my_starred: nextStarred });
      notify({ type: "success", message: nextStarred ? "Message starred." : "Message unstarred." });
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to update star."
      });
    }
  }, [applyMessagePatch, notify]);

  const reactToMessage = useCallback(async (message, reaction) => {
    if (!message?.id) return;
    try {
      const { data } = await api.post(`/messages/${message.id}/react`, { reaction });
      applyMessagePatch(message.id, {
        my_reaction: data.my_reaction || null,
        reactions: data.reactions || {}
      });
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.message || "Unable to react on message."
      });
    }
  }, [applyMessagePatch, notify]);

  const forwardMessage = useCallback(async (msgOrArray) => {
    const messagesArray = Array.isArray(msgOrArray) ? msgOrArray : [msgOrArray];
    if (!messagesArray.length) return;
    const firstMessage = messagesArray[0];
    if (!firstMessage?.id) return;
    if (!firstMessage.e2ee?.key) {
      notify({ type: "error", message: "This message cannot be forwarded (missing encryption envelope)." });
      return;
    }
    const candidates = chats.filter((chat) => (
      chat.id !== activeChatIdRef.current
      && (chat.chat_type === "group" || (!chat.blocked_by_me && !chat.blocked_me))
    ));
    if (!candidates.length) {
      notify({ type: "info", message: "No eligible chat available for forwarding." });
      return;
    }

    setModalConfig({
      type: "forward",
      title: messagesArray.length > 1 ? "Forward Messages" : "Forward Message",
      message: messagesArray.length > 1 
        ? `Select a chat to forward the ${messagesArray.length} messages to:` 
        : "Select a chat to forward the message to:",
      candidates,
      onConfirm: async (targetChatId) => {
        try {
          const recipients = await getChatRecipients(targetChatId);
          const pair = await getOrCreateRsaKeyPair(user.id);
          
          for (const message of messagesArray) {
            const keys = await reencryptAesKeyForRecipients({
              e2ee: message.e2ee,
              privateJwk: pair.privateJwk,
              recipients
            });
            await api.post(`/messages/${message.id}/forward`, { targetChatId, keys });
          }

          notify({ 
            type: "success", 
            message: messagesArray.length > 1 ? `${messagesArray.length} messages forwarded.` : "Message forwarded." 
          });
          setSelectedMessageIds({});
          await loadChats();
        } catch (err) {
          notify({
            type: "error",
            message: err.response?.data?.message || "Unable to forward message(s)."
          });
        }
      }
    });
  }, [chats, getChatRecipients, loadChats, notify, user.id]);

  const toggleSelectMessage = useCallback((message) => {
    if (!message?.id) return;
    setSelectedMessageIds((prev) => {
      const next = { ...prev };
      if (next[message.id]) delete next[message.id];
      else next[message.id] = true;
      return next;
    });
  }, []);

  const handleReply = useCallback((message) => {
    if (!message?.id) return;
    setReplyToMessage({
      id: message.id,
      sender_id: message.sender_id,
      sender_name: message.sender_name
        || (Number(message.sender_id) === Number(user.id) ? "You" : (activeChat?.other_user_name || "User")),
      body: message.body || null,
      image_url: message.image_url || null,
      deleted_for_everyone: Boolean(message.deleted_for_everyone)
    });
  }, [activeChat?.other_user_name, user?.id]);

  const handleSeen = useCallback(() => {
    if (!activeChatIdRef.current) return;
    socket?.emitWithMonitoring?.("seen", { chatId: activeChatIdRef.current }) || socket?.emit("seen", { chatId: activeChatIdRef.current });
  }, [socket]);

  const setWatchSource = useCallback(async ({ chatId, sourceUrl, title }) => {
    if (!socket) {
      notify({ type: "error", message: "Realtime connection is unavailable." });
      return;
    }
    const normalizedChatId = Number(chatId || activeChatIdRef.current);
    if (!normalizedChatId) return;

    socket.emit("watch_session_set", {
      chatId: normalizedChatId,
      sourceUrl: (sourceUrl || "").toString().trim(),
      title: (title || "").toString().trim()
    });
  }, [notify, socket]);

  const clearWatchSession = useCallback(async ({ chatId }) => {
    if (!socket) return;
    const normalizedChatId = Number(chatId || activeChatIdRef.current);
    if (!normalizedChatId) return;
    socket.emit("watch_session_clear", { chatId: normalizedChatId });
  }, [socket]);

  const syncWatchPlayback = useCallback(({ chatId, action, position, playbackRate, isPlaying }) => {
    if (!socket) return;
    const normalizedChatId = Number(chatId || activeChatIdRef.current);
    if (!normalizedChatId) return;
    socket.emit("watch_playback_sync", {
      chatId: normalizedChatId,
      action,
      position,
      playbackRate,
      isPlaying
    });
  }, [socket]);

  const searchQuery = search.trim().toLowerCase();
  const filteredChats = useMemo(() => {
    if (!searchQuery) return chats;
    return chats.filter((chat) => {
      const name = (chat.other_user_name || "").toLowerCase();
      const last = (chat.last_message_body || "").toLowerCase();
      const mobile = (chat.other_user_mobile || "").toLowerCase();
      return name.includes(searchQuery) || last.includes(searchQuery) || mobile.includes(searchQuery);
    });
  }, [chats, searchQuery]);

  const orderedFilteredChats = useMemo(() => {
    const list = Array.isArray(filteredChats) ? filteredChats : [];
    if (!pinnedChatIds.length) return list;
    const pinnedSet = new Set(pinnedChatIds.map((id) => Number(id)).filter(Boolean));
    const pinned = [];
    const others = [];
    list.forEach((chat) => {
      if (pinnedSet.has(Number(chat.id))) pinned.push(chat);
      else others.push(chat);
    });
    return [...pinned, ...others];
  }, [filteredChats, pinnedChatIds]);

  useEffect(() => {
    loadChats(true);
  }, [loadChats]);

  useEffect(() => {
    const handleChatsUpdated = () => {
      loadChats(false);
    };
    const handleChatCleared = (e) => {
      const clearedChatId = Number(e.detail?.chatId);
      if (clearedChatId && activeChatIdRef.current === clearedChatId) {
        setMessages([]);
      }
    };
    window.addEventListener("ana_chats_updated", handleChatsUpdated);
    window.addEventListener("ana_active_chat_cleared", handleChatCleared);
    return () => {
      window.removeEventListener("ana_chats_updated", handleChatsUpdated);
      window.removeEventListener("ana_active_chat_cleared", handleChatCleared);
    };
  }, [loadChats]);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setPeopleResults([]);
      return undefined;
    }

    let cancelled = false;
    setSearchingPeople(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/users", { params: { q: search.trim() } });
        if (cancelled) return;
        const existingIds = new Set(chatsRef.current.map((chat) => chat.other_user_id));
        const list = Array.isArray(data) ? data.filter((person) => !existingIds.has(person.id)) : [];
        setPeopleResults(list.slice(0, 8));
      } catch {
        if (!cancelled) setPeopleResults([]);
      } finally {
        if (!cancelled) setSearchingPeople(false);
      }
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    const pin = search.trim();
    if (!hiddenChatsCount) return undefined;
    if (!CHAT_PIN_PATTERN.test(pin)) return undefined;
    if (pin === chatPinCache && hiddenChats.length > 0) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      await unlockHiddenChatsWithPin(pin, { silent: true });
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, hiddenChatsCount, chatPinCache, hiddenChats.length, unlockHiddenChatsWithPin]);

  const patchActiveCallLog = useCallback((patch) => {
    const id = callRef.current?.logId || callLogIdRef.current;
    if (!id) return;
    patchCallLog(user.id, id, patch || {});
  }, [user.id]);

  const finalizeActiveCallLog = useCallback((status, reason) => {
    const id = callRef.current?.logId || callLogIdRef.current;
    if (!id) return;
    patchCallLog(user.id, id, {
      status: status || "ended",
      reason: reason || "ended",
      ended_at: new Date().toISOString()
    });
    callLogIdRef.current = null;
  }, [user.id]);

  const resetCallState = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    stopStream(screenStreamRef.current);
    stopStream(localStreamRef.current);
    stopStream(remoteStreamRef.current);
    screenStreamRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    incomingOfferRef.current = null;
    audioSenderRef.current = null;
    videoSenderRef.current = null;
    cameraTrackRef.current = null;
    setLocalCallStream(null);
    setRemoteCallStream(null);
    setCall(IDLE_CALL);
  }, []);

  const endCall = useCallback((notifyPeer = true, reason = "ended") => {
    const current = callRef.current;
    if (notifyPeer && socket && current.peerUserId) {
      socket.emit("call_end", {
        toUserId: current.peerUserId,
        chatId: current.chatId,
        reason
      });
    }
    finalizeActiveCallLog(reason === "ended" ? "ended" : reason, reason);
    resetCallState();
  }, [finalizeActiveCallLog, resetCallState, socket]);

  const createPeerConnection = useCallback((targetUserId, chatId, callType) => {
    const connection = new RTCPeerConnection(RTC_CONFIG);
    peerRef.current = connection;

    const remoteMedia = new MediaStream();
    remoteStreamRef.current = remoteMedia;
    setRemoteCallStream(remoteMedia);

    connection.ontrack = (event) => {
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => remoteMedia.addTrack(track));
      });
      setCall((prev) => (
        prev.phase === "outgoing" || prev.phase === "connecting"
          ? { ...prev, phase: "active" }
          : prev
      ));
      patchActiveCallLog({ status: "active" });
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate || !socket) return;
      socket.emit("call_ice_candidate", {
        toUserId: targetUserId,
        candidate: event.candidate,
        chatId
      });
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "connected") {
        setCall((prev) => (
          prev.phase === "active"
            ? prev
            : { ...prev, phase: "active" }
        ));
        patchActiveCallLog({ status: "active" });
      }
      if (["failed", "disconnected", "closed"].includes(connection.connectionState)) {
        endCall(false, "connection_lost");
      }
    };

    audioSenderRef.current = null;
    videoSenderRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const sender = connection.addTrack(track, localStreamRef.current);
        if (track.kind === "audio") audioSenderRef.current = sender;
        if (track.kind === "video") videoSenderRef.current = sender;
      });
    }

    setCall((prev) => ({ ...prev, callType, chatId }));
    return connection;
  }, [endCall, socket]);

  const startCall = useCallback(async (callType, options = {}) => {
    if (!socket || !activeChat?.id) {
      notify({ type: "info", message: "Select a chat first." });
      return;
    }
    if (activeChat.chat_type === "group" || activeChat.chat_type === "self") {
      notify({ type: "info", message: "Voice/video call is currently available only for personal chats." });
      return;
    }
    if (!activeChat?.other_user_id) {
      notify({ type: "info", message: "Call target is not available for this chat." });
      return;
    }
    if (activeChat.blocked_by_me) {
      notify({ type: "info", message: "You blocked this user. Unblock to start a call." });
      return;
    }
    if (activeChat.blocked_me) {
      notify({ type: "info", message: "This user blocked you. Call is not available." });
      return;
    }
    if (callRef.current.phase !== "idle") {
      notify({ type: "info", message: "A call is already in progress." });
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      notify({ type: "error", message: "This browser does not support voice/video calls." });
      return;
    }

    const normalizedType = callType === "video" ? "video" : "voice";
    const callMode = options.mode === "video_chat" ? "video_chat" : "standard";
    const requestAudio = normalizedType === "voice" || callMode !== "video_chat";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: requestAudio,
        video: normalizedType === "video"
      });
      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
      setLocalCallStream(stream);

      const startedAt = new Date().toISOString();
      const logId = appendCallLog(user.id, {
        direction: "outgoing",
        status: "outgoing",
        callType: normalizedType,
        mode: callMode,
        peerUserId: activeChat.other_user_id,
        peerName: activeChat.other_user_name || "Unknown",
        peerAvatar: activeChat.other_user_avatar || null,
        chatId: activeChat.id,
        started_at: startedAt
      });
      callLogIdRef.current = logId;

      setCall({
        phase: "outgoing",
        callType: normalizedType,
        peerUserId: activeChat.other_user_id,
        peerName: activeChat.other_user_name || "Unknown",
        peerAvatar: activeChat.other_user_avatar || null,
        chatId: activeChat.id,
        micEnabled: Boolean(stream.getAudioTracks()[0]?.enabled),
        videoEnabled: Boolean(stream.getVideoTracks()[0]?.enabled),
        screenSharing: false,
        mode: callMode,
        startedAt,
        logId
      });

      const connection = createPeerConnection(activeChat.other_user_id, activeChat.id, normalizedType);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      socket.emit("call_offer", {
        toUserId: activeChat.other_user_id,
        offer,
        chatId: activeChat.id,
        callType: normalizedType,
        mode: callMode
      });
    } catch (err) {
      notify({ type: "error", message: mediaAccessErrorMessage(err, normalizedType) });
      finalizeActiveCallLog("connection_lost", "device_error");
      resetCallState();
    }
  }, [activeChat, createPeerConnection, finalizeActiveCallLog, notify, resetCallState, socket]);

  const acceptIncomingCall = useCallback(async () => {
    const current = callRef.current;
    if (current.phase !== "incoming" || !incomingOfferRef.current || !socket) return;

    if (!navigator?.mediaDevices?.getUserMedia) {
      notify({ type: "error", message: "This browser does not support voice/video calls." });
      socket.emit("call_reject", {
        toUserId: current.peerUserId,
        chatId: current.chatId,
        reason: "device_error"
      });
      finalizeActiveCallLog("device_error", "device_error");
      resetCallState();
      return;
    }

    const requestAudio = current.callType === "voice" || current.mode !== "video_chat";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: requestAudio,
        video: current.callType === "video"
      });
      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
      setLocalCallStream(stream);
      setCall((prev) => ({
        ...prev,
        phase: "connecting",
        micEnabled: Boolean(stream.getAudioTracks()[0]?.enabled),
        videoEnabled: Boolean(stream.getVideoTracks()[0]?.enabled),
        screenSharing: false
      }));
      patchActiveCallLog({ status: "connecting" });

      const connection = createPeerConnection(current.peerUserId, current.chatId, current.callType);
      await connection.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);

      socket.emit("call_answer", {
        toUserId: current.peerUserId,
        answer,
        chatId: current.chatId,
        callType: current.callType,
        mode: current.mode || "standard"
      });
      incomingOfferRef.current = null;
    } catch (err) {
      notify({ type: "error", message: mediaAccessErrorMessage(err, current.callType) });
      socket.emit("call_reject", {
        toUserId: current.peerUserId,
        chatId: current.chatId,
        reason: "device_error"
      });
      finalizeActiveCallLog("device_error", "device_error");
      resetCallState();
    }
  }, [createPeerConnection, finalizeActiveCallLog, notify, patchActiveCallLog, resetCallState, socket]);

  const rejectIncomingCall = useCallback(() => {
    const current = callRef.current;
    if (current.phase !== "incoming" || !socket || !current.peerUserId) return;
    socket.emit("call_reject", {
      toUserId: current.peerUserId,
      chatId: current.chatId,
      reason: "rejected"
    });
    finalizeActiveCallLog("rejected", "rejected");
    resetCallState();
  }, [finalizeActiveCallLog, resetCallState, socket]);

  const stopScreenShare = useCallback(async (silent = false) => {
    if (!callRef.current.screenSharing) return;

    const cameraTrack = cameraTrackRef.current;
    if (videoSenderRef.current) {
      try {
        await videoSenderRef.current.replaceTrack(cameraTrack || null);
      } catch {
        // ignore replace track failures while tearing down
      }
    }

    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;

    if (localStreamRef.current) {
      const previewTracks = [
        ...localStreamRef.current.getAudioTracks(),
        ...(cameraTrack ? [cameraTrack] : [])
      ];
      setLocalCallStream(new MediaStream(previewTracks));
    }

    setCall((prev) => ({
      ...prev,
      screenSharing: false,
      videoEnabled: cameraTrack ? cameraTrack.enabled !== false : prev.videoEnabled
    }));

    if (!silent) {
      notify({ type: "info", message: "Screen sharing stopped." });
    }
  }, [notify]);

  const toggleScreenShare = useCallback(async () => {
    const current = callRef.current;
    if (current.phase === "idle" || current.callType !== "video") return;

    if (current.screenSharing) {
      await stopScreenShare();
      return;
    }

    if (!navigator?.mediaDevices?.getDisplayMedia) {
      notify({ type: "error", message: "Screen share is not supported in this browser." });
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const [screenTrack] = displayStream.getVideoTracks();

      if (!screenTrack) {
        stopStream(displayStream);
        notify({ type: "error", message: "No screen track found." });
        return;
      }

      if (videoSenderRef.current) {
        await videoSenderRef.current.replaceTrack(screenTrack);
      }
      screenStreamRef.current = displayStream;

      screenTrack.onended = () => {
        stopScreenShare(true).catch(() => {});
      };

      const previewTracks = [
        ...(localStreamRef.current ? localStreamRef.current.getAudioTracks() : []),
        screenTrack
      ];
      setLocalCallStream(new MediaStream(previewTracks));
      setCall((prev) => ({
        ...prev,
        screenSharing: true,
        videoEnabled: screenTrack.enabled !== false
      }));
      notify({ type: "success", message: "Screen sharing started." });
    } catch {
      notify({ type: "error", message: "Unable to start screen sharing." });
    }
  }, [notify, stopScreenShare]);

  const toggleMic = useCallback(() => {
    const current = callRef.current;
    if (current.phase === "idle") return;

    if (current.mode === "video_chat") {
      notify({ type: "info", message: "Video chat mode keeps microphone disabled." });
      return;
    }

    const audioTrack = localStreamRef.current?.getAudioTracks?.()[0];
    if (!audioTrack) {
      notify({ type: "error", message: "Microphone track is not available." });
      return;
    }

    const next = !audioTrack.enabled;
    audioTrack.enabled = next;
    if (audioSenderRef.current?.track) {
      audioSenderRef.current.track.enabled = next;
    }
    setCall((prev) => ({ ...prev, micEnabled: next }));
  }, [notify]);

  const toggleVideo = useCallback(() => {
    const current = callRef.current;
    if (current.phase === "idle" || current.callType !== "video") return;

    const activeVideoTrack = videoSenderRef.current?.track
      || (current.screenSharing ? screenStreamRef.current?.getVideoTracks?.()[0] : cameraTrackRef.current);

    if (!activeVideoTrack) {
      notify({ type: "error", message: "Video track is not available." });
      return;
    }

    const next = !activeVideoTrack.enabled;
    activeVideoTrack.enabled = next;
    setCall((prev) => ({ ...prev, videoEnabled: next }));
  }, [notify]);

  const addParticipant = useCallback(() => {
    notify({
      type: "info",
      message: "Add participant UI added. Group call signaling can be enabled next."
    });
  }, [notify]);

  useEffect(() => {
    if (!socket) return undefined;

    console.log("[ChatPage] attaching socket listeners", { socketId: socket.id || null });

    const onReceive = (message) => {
      const chatId = Number(message?.chat_id);
      const messageId = message?.id != null ? String(message.id) : "";
      console.log("[ChatPage] receive_message event", { messageId, chatId });
      if (chatId) lastChatMessageEventAtRef.current.set(chatId, Date.now());

      if (messageId) {
        if (deliveredMessageIdsRef.current.has(messageId)) return;
        deliveredMessageIdsRef.current.add(messageId);
        if (deliveredMessageIdsRef.current.size > 1200) {
          const firstKey = deliveredMessageIdsRef.current.values().next().value;
          if (firstKey) deliveredMessageIdsRef.current.delete(firstKey);
        }
      }

      void (async () => {
        const decryptedMessage = await decryptMessageForMe(message);

        setChats((prev) => {
          const exists = prev.some((chat) => chat.id === decryptedMessage.chat_id);
          const next = exists
            ? prev.map((chat) => (
              chat.id === decryptedMessage.chat_id
                ? {
                    ...chat,
                    last_message_at: decryptedMessage.created_at,
                    last_message_body: decryptedMessage.body,
                    last_message_image: decryptedMessage.image_url
                  }
                : chat
            ))
            : prev;
          return sortChats(next);
        });

        if (decryptedMessage.chat_id === activeChatIdRef.current) {
          setMessages((prev) => {
            if (prev.some((item) => String(item.id) === String(decryptedMessage.id))) return prev;

            const clientId = decryptedMessage.client_message_id;
            const pendingIndex = clientId
              ? prev.findIndex((item) => item.pending && item.client_message_id === clientId)
              : prev.findIndex((item) => (
                item.pending
                && item.sender_id === decryptedMessage.sender_id
                && item.chat_id === decryptedMessage.chat_id
                && (item.body || "") === (decryptedMessage.body || "")
              ));

            if (pendingIndex < 0) return [...prev, decryptedMessage];
            const next = [...prev];
            next[pendingIndex] = decryptedMessage;
            return next;
          });
        } else if (decryptedMessage.sender_id !== user.id) {
          setUnreadByChat((prev) => ({
            ...prev,
            [decryptedMessage.chat_id]: (prev[decryptedMessage.chat_id] || 0) + 1
          }));
        }

        if (decryptedMessage.sender_id !== user.id) {
          const sourceChat = chatsRef.current.find((item) => Number(item.id) === Number(decryptedMessage.chat_id));
          const senderName = sourceChat?.other_user_name || "New message";
          const preview = decryptedMessage.body
            ? decryptedMessage.body.slice(0, 120)
            : (decryptedMessage.image_url ? "Sent media" : "You have a new message");
          notify({
            type: "info",
            title: senderName,
            message: preview,
            isPriority: true
          });
        }
      })();
    };

    const onTyping = ({ chatId, userId, name }) => {
      if (userId === user.id || chatId !== activeChatIdRef.current) return;
      const candidate = (name || "").toString().trim();
      if (candidate) {
        setTypingName(candidate);
      } else {
        const sourceChat = chatsRef.current.find((item) => Number(item.id) === Number(chatId));
        const fallback = sourceChat?.chat_type === "group"
          ? "Someone"
          : (sourceChat?.other_user_name || "Someone");
        setTypingName(fallback);
      }
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        setTyping(false);
        setTypingName("");
      }, 1300);
    };

    const onSeen = ({ chatId }) => {
      if (chatId !== activeChatIdRef.current) return;
      setMessages((prev) => prev.map((msg) => (msg.sender_id === user.id ? { ...msg, seen: 1 } : msg)));
    };

    const onChatUpdated = (payload) => {
      const updatedChatId = Number(payload?.chatId);
      if (updatedChatId) {
        const lastMessageAt = lastChatMessageEventAtRef.current.get(updatedChatId);
        if (lastMessageAt && Date.now() - lastMessageAt < 900) return;
      }
      clearTimeout(chatUpdatedTimerRef.current);
      chatUpdatedTimerRef.current = setTimeout(() => {
        void loadChats();
      }, 250);
    };

    const onMessageUpdated = (payload) => {
      if (!payload?.id || payload.chat_id !== activeChatIdRef.current) return;
      void (async () => {
        const decrypted = await decryptMessageForMe(payload);
        setMessages((prev) => prev.map((item) => (
          String(item.id) === String(decrypted.id)
            ? { ...item, ...decrypted }
            : item
        )));
      })();
    };

    const onMessageDeletedEveryone = (payload) => {
      if (!payload?.messageId || payload.chatId !== activeChatIdRef.current) return;
      setMessages((prev) => prev.map((item) => (
        String(item.id) === String(payload.messageId)
          ? { ...item, body: null, image_url: null, e2ee: null, deleted_for_everyone: true }
          : item
      )));
    };

    const onMessageReaction = (payload) => {
      if (!payload?.messageId || payload.chatId !== activeChatIdRef.current) return;
      setMessages((prev) => prev.map((item) => (
        String(item.id) === String(payload.messageId)
          ? { ...item, reactions: payload.reactions || item.reactions || {} }
          : item
      )));
    };

    const onStatus = ({ userId, status, last_seen }) => {
      const statusUpdatedAt = Date.now();
      setChats((prev) => prev.map((chat) => (
        chat.other_user_id === userId
          ? {
              ...chat,
              other_user_status: status,
              other_user_last_seen: last_seen || chat.other_user_last_seen,
              other_user_status_updated_at: statusUpdatedAt
            }
          : chat
      )));
      setPeopleResults((prev) => prev.map((person) => (
        person.id === userId
          ? { ...person, status, last_seen: last_seen || person.last_seen, status_updated_at: statusUpdatedAt }
          : person
      )));
      setActiveChat((prev) => (
        prev && prev.other_user_id === userId
          ? {
              ...prev,
              other_user_status: status,
              other_user_last_seen: last_seen || prev.other_user_last_seen,
              other_user_status_updated_at: statusUpdatedAt
            }
          : prev
      ));
    };

    const onProfileUpdated = (profile) => {
      if (!profile?.id) return;
      if (profile.id === user.id) reload();
      const aboutBio = (profile.about_bio || "").toString();

      setChats((prev) => prev.map((chat) => (
        chat.other_user_id === profile.id
          ? {
              ...chat,
              other_user_name: profile.name,
              other_user_email: profile.email,
              other_user_mobile: profile.mobile,
              other_user_avatar: chat.chat_type === "self" ? (chat.other_user_avatar || "/logo.png") : profile.avatar_url,
              other_user_about: aboutBio
            }
          : chat
      )));
      setPeopleResults((prev) => prev.map((person) => (person.id === profile.id ? { ...person, ...profile } : person)));
      setActiveChat((prev) => (
        prev && prev.other_user_id === profile.id
          ? {
              ...prev,
              other_user_name: profile.name,
              other_user_email: profile.email,
              other_user_mobile: profile.mobile,
              other_user_avatar: prev.chat_type === "self" ? (prev.other_user_avatar || "/logo.png") : profile.avatar_url,
              other_user_about: aboutBio
            }
          : prev
      ));
    };

    const onCallOffer = async (payload) => {
      if (!payload?.fromUserId || !payload.offer) return;
      if (callRef.current.phase !== "idle") {
        socket.emit("call_reject", {
          toUserId: payload.fromUserId,
          chatId: payload.chatId,
          reason: "busy"
        });
        return;
      }

      incomingOfferRef.current = payload.offer;
      const fallback = chatsRef.current.find((chat) => chat.other_user_id === payload.fromUserId);
      const resolvedChatId = payload.chatId || fallback?.id || null;
      if (resolvedChatId && resolvedChatId !== activeChatIdRef.current) {
        const chatById = chatsRef.current.find((chat) => chat.id === resolvedChatId);
        if (chatById) setActiveChat(chatById);
        else if (fallback) setActiveChat(fallback);
        await loadMessages(resolvedChatId);
      }

      notify({
        type: "info",
        title: payload.fromUserName || fallback?.other_user_name || "Incoming call",
        message: payload.callType === "video" ? "Incoming video call" : "Incoming voice call",
        isPriority: true
      });

      const startedAt = new Date().toISOString();
      const logId = appendCallLog(user.id, {
        direction: "incoming",
        status: "incoming",
        callType: payload.callType === "video" ? "video" : "voice",
        mode: payload.mode === "video_chat" ? "video_chat" : "standard",
        peerUserId: payload.fromUserId,
        peerName: payload.fromUserName || fallback?.other_user_name || "Unknown",
        peerAvatar: payload.fromUserAvatar || fallback?.other_user_avatar || null,
        chatId: resolvedChatId,
        started_at: startedAt
      });
      callLogIdRef.current = logId;

      setCall({
        phase: "incoming",
        callType: payload.callType === "video" ? "video" : "voice",
        peerUserId: payload.fromUserId,
        peerName: payload.fromUserName || fallback?.other_user_name || "Unknown",
        peerAvatar: payload.fromUserAvatar || fallback?.other_user_avatar || null,
        chatId: resolvedChatId,
        micEnabled: payload.mode === "video_chat" ? false : true,
        videoEnabled: payload.callType === "video",
        screenSharing: false,
        mode: payload.mode === "video_chat" ? "video_chat" : "standard",
        startedAt,
        logId
      });
    };

    const onCallAnswer = async (payload) => {
      if (!payload?.fromUserId || !payload?.answer) return;
      if (callRef.current.peerUserId !== payload.fromUserId || !peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        setCall((prev) => ({
          ...prev,
          phase: "connecting",
          mode: payload.mode === "video_chat" ? "video_chat" : prev.mode
        }));
        patchActiveCallLog({ status: "connecting" });
      } catch {
        notify({ type: "error", message: "Call connection failed." });
        finalizeActiveCallLog("connection_lost", "connection_failed");
        resetCallState();
      }
    };

    const onCallIce = async (payload) => {
      if (!payload?.fromUserId || !payload?.candidate || !peerRef.current) return;
      if (callRef.current.peerUserId !== payload.fromUserId) return;
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // ignore stale ice candidates
      }
    };

    const onCallEnd = (payload) => {
      if (payload?.fromUserId && callRef.current.peerUserId !== payload.fromUserId) return;
      const reason = payload?.reason === "no_answer"
        ? "No answer from user."
        : payload?.reason === "connection_lost"
          ? "Call disconnected."
          : "Call ended.";
      notify({ type: "info", message: reason });
      finalizeActiveCallLog(payload?.reason || "ended", payload?.reason || "ended");
      resetCallState();
    };

    const onCallReject = (payload) => {
      if (payload?.fromUserId && callRef.current.peerUserId !== payload.fromUserId) return;
      const reason = payload?.reason === "busy"
        ? "User is busy on another call."
        : payload?.reason === "device_error"
          ? "Call declined (device permission unavailable)."
          : "Call declined.";
      notify({ type: "info", message: reason });
      finalizeActiveCallLog(payload?.reason || "rejected", payload?.reason || "rejected");
      resetCallState();
    };

    const onCallError = (payload) => {
      notify({ type: "error", message: payload?.message || "Call failed." });
      finalizeActiveCallLog("connection_lost", "error");
      resetCallState();
    };

    const onWatchSessionState = (payload) => {
      const chatId = Number(payload?.chatId);
      if (!chatId) return;

      if (payload?.active === false) {
        setWatchSessions((prev) => ({
          ...prev,
          [chatId]: {
            chatId,
            active: false,
            updatedBy: payload?.updatedBy || null,
            updatedAt: payload?.updatedAt || null
          }
        }));
        if (payload?.updatedBy && Number(payload.updatedBy) !== Number(user.id) && chatId === activeChatIdRef.current) {
          notify({ type: "info", message: "Watch Together was stopped." });
        }
        return;
      }

      const nextSession = {
        chatId,
        active: true,
        sourceUrl: (payload?.sourceUrl || "").toString(),
        title: (payload?.title || "").toString(),
        position: Number.isFinite(Number(payload?.position)) ? Number(payload.position) : 0,
        isPlaying: Boolean(payload?.isPlaying),
        playbackRate: Number.isFinite(Number(payload?.playbackRate)) ? Number(payload.playbackRate) : 1,
        updatedBy: payload?.updatedBy || null,
        updatedAt: payload?.updatedAt || null
      };

      setWatchSessions((prev) => ({
        ...prev,
        [chatId]: nextSession
      }));

      if (payload?.updatedBy && Number(payload.updatedBy) !== Number(user.id) && chatId === activeChatIdRef.current) {
        notify({
          type: "info",
          message: nextSession.title
            ? `Watch Together started: ${nextSession.title}`
            : "Watch Together started in this chat."
        });
      }
    };

    const onWatchPlaybackSync = (payload) => {
      const chatId = Number(payload?.chatId);
      if (!chatId) return;

      setWatchSessions((prev) => {
        const existing = prev[chatId];
        if (!existing?.active) return prev;
        return {
          ...prev,
          [chatId]: {
            ...existing,
            position: Number.isFinite(Number(payload?.position)) ? Number(payload.position) : existing.position,
            isPlaying: typeof payload?.isPlaying === "boolean" ? payload.isPlaying : existing.isPlaying,
            playbackRate: Number.isFinite(Number(payload?.playbackRate))
              ? Number(payload.playbackRate)
              : existing.playbackRate,
            updatedBy: payload?.updatedBy || existing.updatedBy,
            updatedAt: payload?.updatedAt || existing.updatedAt
          }
        };
      });
    };

    const onWatchError = (payload) => {
      notify({ type: "error", message: payload?.message || "Watch Together failed." });
    };

    const onMessageDelivered = (payload) => {
      const { messageId, deliveredAt } = payload;
      if (!messageId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, delivery_status: "delivered", delivered_at: deliveredAt }
            : msg
        )
      );
    };

    const onMessageRead = (payload) => {
      const { messageId, readAt } = payload;
      if (!messageId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, delivery_status: "read", read_at: readAt }
            : msg
        )
      );
    };

    const onMessageStatusUpdate = (payload) => {
      const { messageId, status, timestamp } = payload;
      if (!messageId || !status) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                delivery_status: status,
                ...(status === "delivered" && { delivered_at: timestamp }),
                ...(status === "read" && { read_at: timestamp })
              }
            : msg
        )
      );
    };

    const socketEvents = [
      ["receive_message", onReceive],
      ["typing", onTyping],
      ["seen", onSeen],
      ["chat_updated", onChatUpdated],
      ["message_updated", onMessageUpdated],
      ["message_deleted_everyone", onMessageDeletedEveryone],
      ["message_reaction", onMessageReaction],
      ["user_status", onStatus],
      ["user_profile_updated", onProfileUpdated],
      ["call_offer", onCallOffer],
      ["call_answer", onCallAnswer],
      ["call_ice_candidate", onCallIce],
      ["call_end", onCallEnd],
      ["call_reject", onCallReject],
      ["call_error", onCallError],
      ["watch_session_state", onWatchSessionState],
      ["watch_playback_sync", onWatchPlaybackSync],
      ["watch_error", onWatchError],
      ["message_delivered", onMessageDelivered],
      ["message_read", onMessageRead],
      ["message_status_update", onMessageStatusUpdate]
    ];

    if (socket && socket.on && socket.off) {
      socketEvents.forEach(([event, handler]) => socket.on(event, handler));
    }

    return () => {
      console.log("[ChatPage] detaching socket listeners", { socketId: socket.id || null });
      if (socket && socket.off) {
        socketEvents.forEach(([event, handler]) => socket.off(event, handler));
      }
      clearTimeout(typingTimer.current);
      clearTimeout(chatUpdatedTimerRef.current);
    };
  }, [loadChats, loadMessages, notify, reload, resetCallState, socket, user?.id]);

  useEffect(() => {
    if (!socket || !activeChat?.id) return;

    console.log("[ChatPage] joining chat room", activeChat.id);
    socket.joinRoom(activeChat.id);

    return () => {
      if (socket && activeChat?.id) {
        console.log("[ChatPage] leaving chat room", activeChat.id);
        socket.leaveRoom(activeChat.id);
      }
    };
  }, [activeChat?.id, socket]);

  useEffect(() => {
    if (!isMobile) setMobileChatOpen(false);
  }, [isMobile]);

  useEffect(() => {
    try {
      const stored = (window.localStorage.getItem(sidebarTabStorageKey) || "").toString();
      if (stored === "status" || stored === "calls" || stored === "chats") setActiveSidebarTab(stored);
      else setActiveSidebarTab("chats");
    } catch {
      setActiveSidebarTab("chats");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarTabStorageKey]);

  useEffect(() => {
    if (!isMobile) return;
    if (activeSidebarTab !== "chats") setMobileChatOpen(false);
  }, [activeSidebarTab, isMobile]);

  useEffect(() => {
    if (call.phase !== "outgoing") return undefined;
    const timer = setTimeout(() => {
      if (callRef.current.phase !== "outgoing") return;
      notify({ type: "info", message: "No answer from user." });
      endCall(false, "no_answer");
    }, 32000);
    return () => clearTimeout(timer);
  }, [call.phase, endCall, notify]);

  useEffect(() => () => {
    toastTimers.current.forEach((timer) => clearTimeout(timer));
    toastTimers.current.clear();
    deliveredMessageIdsRef.current.clear();
    if (callRef.current.phase !== "idle") {
      endCall(true, "ended");
    } else {
      resetCallState();
    }
  }, [endCall, resetCallState]);

  const activeIsGroup = activeChat?.chat_type === "group";
  const activeIsSelf = activeChat?.chat_type === "self";
  const activeBlockedByMe = !activeIsGroup && !activeIsSelf && Boolean(activeChat?.blocked_by_me);
  const activeBlockedMe = !activeIsGroup && !activeIsSelf && Boolean(activeChat?.blocked_me);
  const activeWatchSession = activeChat ? (watchSessions[activeChat.id] || null) : null;
  const partner = activeChat
    ? {
        id: activeIsGroup ? null : activeChat.other_user_id,
        name: activeChat.other_user_name || activeChat.group_name,
        avatar_url: activeChat.other_user_avatar || activeChat.group_avatar_url,
        status: activeIsGroup ? "group" : (activeIsSelf ? "self" : activeChat.other_user_status),
        status_updated_at: activeIsGroup ? null : activeChat.other_user_status_updated_at,
        last_seen: activeIsGroup ? null : activeChat.other_user_last_seen,
        email: activeIsGroup ? null : activeChat.other_user_email,
        mobile: activeIsGroup ? null : activeChat.other_user_mobile,
        about: activeIsGroup ? "" : (activeChat.other_user_about || ""),
        blocked_by_me: activeBlockedByMe,
        blocked_me: activeBlockedMe,
        member_count: Number(activeChat.member_count || 0),
        is_group: activeIsGroup,
        is_self: activeIsSelf
      }
    : null;

  const isChatTab = activeSidebarTab === "chats";
  const showSidebar = !isMobile || (activeSidebarTab === "status" && !selectedStatusFeed) || (!isChatTab || !mobileChatOpen);
  const showRightPane = !isMobile || (isChatTab && mobileChatOpen) || (activeSidebarTab === "status" && selectedStatusFeed);

  return (
    <div className="relative h-[100dvh] overflow-hidden chat-surface p-0">
      <div className="relative grid h-full w-full grid-cols-1 md:grid-cols-[minmax(280px,330px)_minmax(0,1fr)] gap-0">
        {showSidebar && (
          <div className="min-h-0 min-w-0 h-full">
            <SidebarPanel
              me={user}
              theme={theme}
              sidebarColor={sidebarColor}
              isSidebarLight={isSidebarLight}
              activeTab={activeSidebarTab}
              onActiveTabChange={setActiveSidebarTab}
              onOpenProfile={() => setProfileOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenCallLogs={() => setCallLogsOpen(true)}
              onAdmin={() => {
                navigateTo("admin");
              }}
              onLogout={logout}
              search={search}
              onSearch={setSearch}
              chats={orderedFilteredChats}
              allChats={chats}
              loadingChats={loadingChats}
              activeChatId={activeChat?.id}
              unreadByChat={unreadByChat}
              onSelectChat={selectChat}
              pinnedChatIds={pinnedChatIds}
              onTogglePinChat={togglePinChat}
              onHideChat={hideChatById}
              onDeleteChat={deleteChatById}
              peopleResults={peopleResults}
              searchingPeople={searchingPeople}
              onStartChat={createChat}
              onCreateGroup={openGroupCreator}
              showOnlineStatus={userSettings.showOnlineStatus}
              hiddenChats={hiddenChats}
              hiddenChatsCount={hiddenChatsCount}
              hiddenChatsUnlocked={Boolean(chatPinCache)}
              onUnhideChat={unhideChat}
              compactMode={userSettings.compactMode}
              selectedStatusFeed={selectedStatusFeed}
              onSelectStatusFeed={setSelectedStatusFeed}
            />
          </div>
        )}

        {showRightPane && (
          <div className="min-h-0 min-w-0 h-full panel-in">
            {activeSidebarTab === "status" ? (
              <StatusPanel
                me={user}
                mobile={isMobile}
                selectedStatusFeed={selectedStatusFeed}
                onSelectStatusFeed={setSelectedStatusFeed}
                onBack={() => setSelectedStatusFeed(null)}
              />
            ) : activeSidebarTab === "calls" ? (
              isMobile ? null : (
                <CallsPanel me={user} />
              )
            ) : (
              <ChatPane
                meId={user?.id}
                isAdminUser={Boolean(user?.isAdmin)}
                activeChat={activeChat}
                partner={partner}
                messages={messages}
                loadingMessages={loadingMessages}
                typing={typing}
                typingName={typingName}
                uploadBase={API_BASE_URL}
                onTyping={() => socket?.emit("typing", { chatId: activeChat?.id })}
                chatPaneColor={chatPaneColor}
                onSeen={handleSeen}
                onSend={sendMessage}
                replyToMessage={replyToMessage}
                onCancelReply={() => setReplyToMessage(null)}
                enterToSend={userSettings.enterToSend}
                onVoiceCall={() => startCall("voice")}
                onVideoCall={() => startCall("video")}
                onVideoChat={() => startCall("video", { mode: "video_chat" })}
                onOpenCallLogs={() => setCallLogsOpen(true)}
                watchSession={activeWatchSession}
                onSetWatchSource={setWatchSource}
                onClearWatchSession={clearWatchSession}
                onWatchPlaybackSync={syncWatchPlayback}
                onRefreshMessages={refreshActiveChatMessages}
                onSetChatBackground={setChatBackground}
                onClearChatBackground={clearChatBackground}
                onHideChat={hideActiveChat}
                onDeleteChat={deleteChatById}
                onBlockUser={blockActiveUser}
                onUnblockUser={unblockActiveUser}
                onReportUser={reportUser}
                blockActionBusy={blockActionBusy}
                onBackMobile={() => setMobileChatOpen(false)}
                onReply={handleReply}
                onDeleteLocal={removeLocalMessage}
                onEditMessage={editMessage}
                onDeleteForEveryone={deleteForEveryone}
                onToggleStar={toggleStarMessage}
                onReact={reactToMessage}
                onForward={forwardMessage}
                onSelectToggle={toggleSelectMessage}
                selectedMessageIds={selectedMessageIds}
                onClearSelection={() => setSelectedMessageIds({})}
                compactMode={userSettings.compactMode}
                showOnlineStatus={userSettings.showOnlineStatus}
                isGroupChat={activeIsGroup}
                isSelfChat={activeIsSelf}
                memberCount={Number(activeChat?.member_count || 0)}
                theme={theme}
                notify={notify}
                isChatPaneLight={isChatPaneLight}
                mobile={isMobile}
              />
            )}
          </div>
        )}
      </div>

      <ProfileDrawer
        open={profileOpen}
        me={user}
        onClose={() => setProfileOpen(false)}
        onSaved={async () => {
          await reload();
          await loadChats();
          setProfileOpen(false);
        }}
        notify={notify}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentSettings={userSettings}
        onSave={saveUiSettings}
        saving={settingsSaving}
        anaSecurityPinEnabled={Boolean(user?.anaSecurityPinEnabled)}
        onSecurityUpdated={reload}
        theme={theme}
        onToggleTheme={toggleTheme}
        doodleStyle={doodleStyle}
        onSetDoodleStyle={setDoodleStyle}
        accentColor={accentColor}
        onSetAccentColor={setAccentColor}
        onSetSidebarColor={setSidebarColor}
        onSetChatPaneColor={setChatPaneColor}
      />

      <CreateGroupModal
        open={groupModalOpen}
        users={groupUsers}
        loading={groupUsersLoading}
        creating={groupCreating}
        onClose={() => setGroupModalOpen(false)}
        onCreate={createGroup}
      />

      <CallOverlay
        call={call}
        localStream={localCallStream}
        remoteStream={remoteCallStream}
        meId={user?.id}
        chatMessages={messages}
        onSendChat={sendCallChatMessage}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
        onEnd={() => endCall(true, "ended")}
        onToggleMic={toggleMic}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onAddParticipant={addParticipant}
        micEnabled={Boolean(call.micEnabled)}
        videoEnabled={Boolean(call.videoEnabled)}
        screenSharing={Boolean(call.screenSharing)}
      />

      <CallLogsDrawer me={user} open={callLogsOpen} onClose={() => setCallLogsOpen(false)} />

      <ToastStack toasts={toasts} onRemove={dismissToast} />

      {modalConfig && (
        <CustomDialogModal
          config={modalConfig}
          onClose={() => setModalConfig(null)}
        />
      )}

      {isOffline && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md transition-all duration-300">
          <div className="flex w-full max-w-sm flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-900/90 p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-300">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-rose-500/10 opacity-75" />
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wifi-off">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.5"/>
                <path d="M5 12.5a10.94 10.94 0 0 1 5.83-2.84"/>
                <path d="M8.5 16.5a5 5 0 0 1 7 0"/>
                <path d="M21.3 7A16.9 16.9 0 0 0 18.5 5.5"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-100">Connection Lost</h3>
            <p className="mb-6 text-sm text-slate-400">
              You are currently offline. Please check your internet connection. We'll automatically reconnect once you're back online.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-accent">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Waiting for connection...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomDialogModal({ config, onClose }) {
  const [inputValue, setInputValue] = useState(config.defaultValue || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (config.type === "prompt") {
      inputRef.current?.focus();
    }
  }, [config.type]);

  const handleSubmit = (e) => {
    e.preventDefault();
    config.onConfirm?.(inputValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-200 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {config.title}
          </h3>
          {config.message && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {config.message}
            </p>
          )}
        </div>

        {config.type === "prompt" && (
          <form onSubmit={handleSubmit} className="w-full">
            <input
              ref={inputRef}
              type={config.isPassword ? "password" : "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={config.placeholder}
              className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:text-slate-100 dark:focus:border-violet-500"
            />
          </form>
        )}

        {config.type === "forward" && (
          <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1">
            {config.candidates?.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => {
                  config.onConfirm?.(chat.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition text-left"
              >
                <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm font-semibold text-violet-700 dark:text-violet-300">
                  {(chat.other_user_name || chat.group_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {chat.other_user_name || chat.group_name}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {chat.chat_type === "group" ? "Group Chat" : "Private Chat"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-2">
          {config.type !== "alert" && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
            >
              Cancel
            </button>
          )}
          {config.type !== "forward" && (
            <button
              type="button"
              onClick={() => {
                config.onConfirm?.(inputValue);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition active:scale-[0.98]"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function playMessageTone(kind = "info") {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    const map = {
      success: { type: "triangle", freq: 880 },
      error: { type: "sawtooth", freq: 320 },
      info: { type: "sine", freq: 720 }
    };
    const tone = map[kind] || map.info;
    oscillator.type = tone.type;
    oscillator.frequency.value = tone.freq;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    oscillator.onended = () => context.close().catch(() => {});
  } catch {
    // ignore audio playback errors
  }
}
