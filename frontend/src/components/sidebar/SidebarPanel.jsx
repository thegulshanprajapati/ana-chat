import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  CircleDot,
  Camera,
  Layers,
  MessageCircle,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Plus,
  Video,
  PlusCircle,
  Search,
  UserRound,
  Users,
  UsersRound,
  X
} from "lucide-react";
import SidebarHeader from "./SidebarHeader";
import ChatListItem from "./ChatListItem";
import ChatListSkeleton from "./ChatListSkeleton";
import Avatar from "../common/Avatar";
import StatusViewerModal from "./StatusViewerModal";
import { clearCallLogs, getCallLogs } from "../../utils/callLogs";
import { formatDayLabel, formatTime } from "../../utils/time";

const BUILTIN_FILTERS = [
  { id: "all", label: "All", icon: Layers },
  { id: "personal", label: "Personal", icon: UserRound },
  { id: "group", label: "Group", icon: Users }
];

const SIDEBAR_TAB_KEY = "anach_sidebar_tab_v1";
const STATUS_STORAGE_PREFIX = "anach_status_v1";
const STATUS_FEED_STORAGE_PREFIX = "anach_status_feed_v1";

function sanitizeFilters(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const name = (item.name || "").toString().trim().slice(0, 28);
      const chatIds = Array.isArray(item.chatIds)
        ? [...new Set(item.chatIds.map(Number).filter(Boolean))]
        : [];
      if (!name || !chatIds.length) return null;
      return {
        id: (item.id || `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).toString(),
        name,
        chatIds
      };
    })
    .filter(Boolean);
}

function readStoredFilters(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return sanitizeFilters(parsed);
  } catch {
    return [];
  }
}

function groupByDay(items) {
  const groups = new Map();
  (items || []).forEach((item) => {
    const day = formatDayLabel(item.started_at || item.created_at) || "Unknown";
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(item);
  });
  return [...groups.entries()];
}

function durationLabel(start, end) {
  const s = start ? new Date(start).getTime() : NaN;
  const e = end ? new Date(end).getTime() : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return "";
  const total = Math.round((e - s) / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function callStatusLabel(item) {
  const status = (item?.status || "").toString();
  if (status === "missed") return "Missed";
  if (status === "rejected") return "Declined";
  if (status === "busy") return "Busy";
  if (status === "no_answer") return "No answer";
  if (status === "connection_lost") return "Disconnected";
  if (status === "ended") return "Ended";
  if (status === "active") return "Active";
  if (status === "incoming") return "Incoming";
  if (status === "outgoing") return "Outgoing";
  return status ? status : "Call";
}

export default function SidebarPanel({
  me,
  theme,
  sidebarColor,
  isSidebarLight,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  onOpenProfile,
  onOpenSettings,
  onOpenCallLogs,
  onAdmin,
  onLogout,
  search,
  onSearch,
  chats,
  allChats,
  loadingChats,
  activeChatId,
  unreadByChat,
  onSelectChat,
  peopleResults,
  searchingPeople,
  onStartChat,
  onCreateGroup,
  showOnlineStatus = true,
  hiddenChats = [],
  hiddenChatsCount = 0,
  hiddenChatsUnlocked = false,
  onUnhideChat,
  compactMode = false
}) {
  const storageKey = useMemo(() => `chat_custom_filters_${me?.id || "guest"}`, [me?.id]);
  const sourceChats = useMemo(() => (Array.isArray(allChats) ? allChats : []), [allChats]);
  const isDarkTheme = theme === "dark";
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasCustomSidebarColor = Boolean(sidebarColor);
  const customSidebarDark = hasCustomSidebarColor && !isSidebarLight;
  const sidebarLabelClass = hasCustomSidebarColor
    ? (isSidebarLight ? "text-slate-600" : "text-white/70")
    : "text-slate-500 dark:text-slate-400";

  const [activeFilter, setActiveFilter] = useState("all");
  const [customFilters, setCustomFilters] = useState(() => readStoredFilters(storageKey));
  const [createFilterOpen, setCreateFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState({});
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const quickActionsRef = useRef(null);

  const tabStorageKey = useMemo(() => `${SIDEBAR_TAB_KEY}_${me?.id || "guest"}`, [me?.id]);
  const [internalActiveTab, setInternalActiveTab] = useState(() => {
    try {
      const stored = (window.localStorage.getItem(tabStorageKey) || "").toString();
      if (stored === "status" || stored === "calls" || stored === "chats") return stored;
    } catch {
      // ignore
    }
    return "chats";
  });

  const activeTab = (controlledActiveTab === "status" || controlledActiveTab === "calls" || controlledActiveTab === "chats")
    ? controlledActiveTab
    : internalActiveTab;

  function updateActiveTab(nextTab) {
    const next = (nextTab === "status" || nextTab === "calls" || nextTab === "chats") ? nextTab : "chats";
    if (controlledActiveTab == null) setInternalActiveTab(next);
    onActiveTabChange?.(next);
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(tabStorageKey, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab, tabStorageKey]);

  const statusStorageKey = useMemo(() => `${STATUS_STORAGE_PREFIX}_${me?.id || "guest"}`, [me?.id]);
  const [myStatus] = useState(() => {
    try {
      const raw = window.localStorage.getItem(statusStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return { text: "", updatedAt: "" };
      return { text: (parsed.text || "").toString().slice(0, 140), updatedAt: (parsed.updatedAt || "").toString() };
    } catch {
      return { text: "", updatedAt: "" };
    }
  });

  const [callLogs, setCallLogs] = useState([]);
  const statusFeedStorageKey = useMemo(() => `${STATUS_FEED_STORAGE_PREFIX}_${me?.id || "guest"}`, [me?.id]);
  const [anaUpdates, setAnaUpdates] = useState(() => {
    try {
      const raw = window.localStorage.getItem(statusFeedStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: (item.id || "").toString(),
          created_at: (item.created_at || "").toString(),
          text: (item.text || "").toString().slice(0, 600),
          mediaType: item.mediaType === "video" ? "video" : (item.mediaType === "image" ? "image" : ""),
          mediaDataUrl: (item.mediaDataUrl || "").toString(),
          transient: false
        }))
        .filter((item) => item.id && item.created_at);
    } catch {
      return [];
    }
  });
  const [anaUpdateText, setAnaUpdateText] = useState("");
  const [anaUpdateMedia, setAnaUpdateMedia] = useState(null); // { type: "image"|"video", url?: string, dataUrl?: string, transient?: boolean, name?: string }
  const imagePickerRef = useRef(null);
  const videoPickerRef = useRef(null);
  const [statusViewerOpen, setStatusViewerOpen] = useState(false);
  const [statusViewerIndex, setStatusViewerIndex] = useState(0);
  const [contactStatusViewerOpen, setContactStatusViewerOpen] = useState(false);
  const [contactStatusViewerData, setContactStatusViewerData] = useState(null); // { name, avatar, subtitle, items }

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(customFilters));
  }, [customFilters, storageKey]);

  useEffect(() => {
    setCallLogs(getCallLogs());

    function sync() {
      setCallLogs(getCallLogs());
    }

    window.addEventListener("storage", sync);
    window.addEventListener("anach_call_logs_updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("anach_call_logs_updated", sync);
    };
  }, []);

  useEffect(() => {
    try {
      const persistable = anaUpdates.filter((item) => !item.transient && item.mediaType !== "video");
      window.localStorage.setItem(statusFeedStorageKey, JSON.stringify(persistable.slice(0, 60)));
    } catch {
      // ignore
    }
  }, [anaUpdates, statusFeedStorageKey]);

  useEffect(() => {
    if (!quickActionsOpen) return undefined;

    function handlePointerDown(event) {
      if (!quickActionsRef.current?.contains(event.target)) {
        setQuickActionsOpen(false);
      }
    }

    function handleEsc(event) {
      if (event.key === "Escape") setQuickActionsOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [quickActionsOpen]);

  const resolvedActiveFilter = useMemo(() => {
    if (activeFilter === "all" || activeFilter === "personal" || activeFilter === "group") return activeFilter;
    return customFilters.some((filter) => filter.id === activeFilter) ? activeFilter : "all";
  }, [activeFilter, customFilters]);

  const filteredChats = useMemo(() => {
    if (resolvedActiveFilter === "all") return chats;
    if (resolvedActiveFilter === "personal") {
      return chats.filter((chat) => chat.chat_type !== "group");
    }
    if (resolvedActiveFilter === "group") {
      return chats.filter((chat) => chat.chat_type === "group");
    }

    const custom = customFilters.find((item) => item.id === resolvedActiveFilter);
    if (!custom) return chats;
    const selectedIds = new Set(custom.chatIds.map(Number));
    return chats.filter((chat) => selectedIds.has(Number(chat.id)));
  }, [resolvedActiveFilter, chats, customFilters]);

  const statusChats = useMemo(
    () => sourceChats
      .filter((chat) => chat && typeof chat === "object" && chat.chat_type !== "group" && chat.chat_type !== "self")
      .slice(0, 40),
    [sourceChats]
  );

  const callLogGroups = useMemo(() => groupByDay(callLogs), [callLogs]);
  const missedCallCount = useMemo(
    () => (callLogs || []).filter((item) => ["missed", "rejected", "busy", "no_answer"].includes(item?.status)).length,
    [callLogs]
  );

  function resetCreateFilterState() {
    setNewFilterName("");
    setSelectedChatIds({});
    setFilterError("");
  }

  function openCreateFilter() {
    resetCreateFilterState();
    setCreateFilterOpen(true);
  }

  function closeCreateFilter() {
    setCreateFilterOpen(false);
    resetCreateFilterState();
  }

  function toggleChatForFilter(chatId) {
    setSelectedChatIds((prev) => {
      const next = { ...prev };
      if (next[chatId]) delete next[chatId];
      else next[chatId] = true;
      return next;
    });
  }

  function clearAnaUpdateMedia() {
    if (anaUpdateMedia?.url) {
      try {
        URL.revokeObjectURL(anaUpdateMedia.url);
      } catch {
        // ignore
      }
    }
    setAnaUpdateMedia(null);
    if (imagePickerRef.current) imagePickerRef.current.value = "";
    if (videoPickerRef.current) videoPickerRef.current.value = "";
  }

  function handlePickedImage(file) {
    if (!file) return;
    clearAnaUpdateMedia();

    const maxInlineBytes = 900 * 1024;
    if (file.size <= maxInlineBytes) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = (reader.result || "").toString();
        setAnaUpdateMedia({ type: "image", dataUrl, name: file.name, transient: false });
      };
      reader.readAsDataURL(file);
      return;
    }

    const url = URL.createObjectURL(file);
    setAnaUpdateMedia({ type: "image", url, name: file.name, transient: true });
  }

  function handlePickedVideo(file) {
    if (!file) return;
    clearAnaUpdateMedia();
    const url = URL.createObjectURL(file);
    setAnaUpdateMedia({ type: "video", url, name: file.name, transient: true });
  }

  function postAnaUpdate() {
    const text = (anaUpdateText || "").toString().trim();
    if (!text && !anaUpdateMedia) return;

    const now = new Date().toISOString();
    const mediaType = anaUpdateMedia?.type || "";
    const item = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: now,
      text: text.slice(0, 600),
      mediaType: mediaType === "video" ? "video" : (mediaType === "image" ? "image" : ""),
      mediaDataUrl: anaUpdateMedia?.dataUrl ? anaUpdateMedia.dataUrl : "",
      mediaUrl: anaUpdateMedia?.url ? anaUpdateMedia.url : "",
      transient: Boolean(anaUpdateMedia?.transient) || mediaType === "video"
    };

    setAnaUpdates((prev) => [item, ...(prev || [])].slice(0, 60));
    setAnaUpdateText("");
    clearAnaUpdateMedia();
  }

  function removeAnaUpdate(id) {
    setAnaUpdates((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const existing = list.find((item) => item?.id === id);
      if (existing?.transient && existing?.mediaUrl) {
        try {
          URL.revokeObjectURL(existing.mediaUrl);
        } catch {
          // ignore
        }
      }
      return list.filter((item) => item?.id !== id);
    });
  }

  function openStatusViewerById(id) {
    const idx = anaUpdates.findIndex((item) => item?.id === id);
    if (idx < 0) return;
    setStatusViewerIndex(idx);
    setStatusViewerOpen(true);
  }

  function openContactStatus(chat) {
    const name = (chat?.other_user_name || chat?.group_name || "Status").toString();
    const avatar = chat?.other_user_avatar || chat?.group_avatar_url || null;
    const text = (chat?.other_user_status || chat?.other_user_about || "No status update").toString();
    const createdAt = chat?.other_user_last_seen || chat?.last_message_at || chat?.last_message_created_at || new Date().toISOString();
    setContactStatusViewerData({
      name,
      avatar,
      subtitle: formatDayLabel(createdAt) === "Today"
        ? (formatTime(createdAt) || "Today")
        : (formatDayLabel(createdAt) || ""),
      items: [{ id: `s-${chat?.id || name}`, created_at: createdAt, text, mediaType: "", mediaDataUrl: "", mediaUrl: "" }]
    });
    setContactStatusViewerOpen(true);
  }

  function clearAnaUpdates() {
    setAnaUpdates((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      list.forEach((item) => {
        if (item?.transient && item?.mediaUrl) {
          try {
            URL.revokeObjectURL(item.mediaUrl);
          } catch {
            // ignore
          }
        }
      });
      return [];
    });
  }

  function saveCustomFilter() {
    const name = newFilterName.trim();
    if (name.length < 2) {
      setFilterError("List name should be at least 2 characters.");
      return;
    }

    const duplicate = customFilters.some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setFilterError("List name already exists.");
      return;
    }

    const chatIds = Object.keys(selectedChatIds)
      .filter((id) => selectedChatIds[id])
      .map(Number)
      .filter(Boolean);

    if (!chatIds.length) {
      setFilterError("Select at least one chat.");
      return;
    }

    const next = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.slice(0, 28),
      chatIds
    };

    setCustomFilters((prev) => [...prev, next]);
    setActiveFilter(next.id);
    setCreateFilterOpen(false);
    resetCreateFilterState();
  }

  function removeCustomFilter(filterId) {
    setCustomFilters((prev) => prev.filter((item) => item.id !== filterId));
    if (activeFilter === filterId) setActiveFilter("all");
  }

  useEffect(() => {
    if (activeTab === "chats") return;
    setQuickActionsOpen(false);
  }, [activeTab]);

  const tabOrder = useMemo(() => ["chats", "status", "calls"], []);
  const activeTabIndex = Math.max(0, tabOrder.indexOf(activeTab));
  const [hoverTabIndex, setHoverTabIndex] = useState(null);
  const sliderRef = useRef(null);
  const swipeRef = useRef({ x: 0, y: 0, dx: 0, dy: 0, mode: null, width: 0 });
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  function setTabByIndex(index) {
    const nextIndex = Math.max(0, Math.min(tabOrder.length - 1, Number(index) || 0));
    const nextTab = tabOrder[nextIndex] || "chats";
    updateActiveTab(nextTab);
  }

  function handleTabSwipeStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;
    const width = sliderRef.current?.clientWidth || window.innerWidth || 1;
    swipeRef.current = { x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, mode: null, width };
    setDragging(false);
    setDragOffset(0);
  }

  function handleTabSwipeMove(event) {
    const touch = event.touches?.[0];
    if (!touch) return;
    const dx = touch.clientX - swipeRef.current.x;
    const dy = touch.clientY - swipeRef.current.y;
    swipeRef.current.dx = dx;
    swipeRef.current.dy = dy;

    if (!swipeRef.current.mode) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 8 && absY < 8) return;
      swipeRef.current.mode = absX > absY * 1.2 ? "horizontal" : "vertical";
    }

    if (swipeRef.current.mode !== "horizontal") return;
    const width = swipeRef.current.width || 1;
    const clamped = Math.max(-width, Math.min(width, dx));
    setDragging(true);
    setDragOffset(clamped);
  }

  function handleTabSwipeEnd() {
    if (swipeRef.current.mode !== "horizontal") {
      swipeRef.current.mode = null;
      setDragging(false);
      setDragOffset(0);
      return;
    }
    const width = swipeRef.current.width || 1;
    const dx = swipeRef.current.dx || 0;
    const threshold = Math.max(52, Math.round(width * 0.22));

    if (dx > threshold) setTabByIndex(activeTabIndex - 1);
    else if (dx < -threshold) setTabByIndex(activeTabIndex + 1);

    swipeRef.current.mode = null;
    setDragging(false);
    setDragOffset(0);
  }

  return (
    <>
      <aside
        className={`relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm sm:rounded-lg dark:border-slate-800 dark:bg-slate-950 ${
          isSidebarLight ? "text-gray-900" : "text-white"
        }`}
        style={sidebarColor ? { backgroundColor: sidebarColor } : undefined}
      >
        <SidebarHeader
          me={me}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onOpenCallLogs={onOpenCallLogs}
          onAdmin={onAdmin}
          onLogout={onLogout}
          isSidebarLight={isSidebarLight}
          hasCustomColor={hasCustomSidebarColor}
          compactMode={compactMode}
        />

        <div
          className={`${compactMode ? "px-3 pt-2" : "px-4 pt-2.5"}`}
          onMouseLeave={() => setHoverTabIndex(null)}
        >
          <div
            className={`relative grid grid-cols-3 rounded-2xl border p-1 ${
            hasCustomSidebarColor
              ? (isSidebarLight ? "border-slate-200 bg-white/70" : "border-white/20 bg-white/10")
              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          }`}>
            {(() => {
              const isHovering = Number.isFinite(hoverTabIndex) && hoverTabIndex !== activeTabIndex;
              const indicatorIndex = Number.isFinite(hoverTabIndex) ? hoverTabIndex : activeTabIndex;
              const indicatorBgClass = isHovering ? "bg-[var(--accent-soft-10)]" : "bg-accent-soft";
              return (
                <>
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-1 left-1 rounded-2xl opacity-100 blur-[12px] transition-[transform] duration-[420ms] ease-[cubic-bezier(0.2,1,0.2,1)] ${indicatorBgClass}`}
              style={{
                width: "calc((100% - 0.5rem) / 3)",
                transform: `translate3d(${indicatorIndex * 100}%, 0, 0)`
              }}
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-1 left-1 rounded-2xl transition-[transform] duration-[420ms] ease-[cubic-bezier(0.2,1,0.2,1)] ${indicatorBgClass}`}
              style={{
                width: "calc((100% - 0.5rem) / 3)",
                transform: `translate3d(${indicatorIndex * 100}%, 0, 0)`
              }}
            />
                </>
              );
            })()}
            <TabButton
              active={activeTab === "chats"}
              label="Chats"
              onClick={() => updateActiveTab("chats")}
              onHover={() => setHoverTabIndex(0)}
              hasCustomColor={hasCustomSidebarColor}
              isSidebarLight={isSidebarLight}
              icon={<MessageCircle size={14} />}
            />
            <TabButton
              active={activeTab === "status"}
              label="Status"
              onClick={() => updateActiveTab("status")}
              onHover={() => setHoverTabIndex(1)}
              hasCustomColor={hasCustomSidebarColor}
              isSidebarLight={isSidebarLight}
              icon={<CircleDot size={14} />}
            />
            <TabButton
              active={activeTab === "calls"}
              label="Calls"
              onClick={() => updateActiveTab("calls")}
              onHover={() => setHoverTabIndex(2)}
              hasCustomColor={hasCustomSidebarColor}
              isSidebarLight={isSidebarLight}
              badgeCount={missedCallCount}
              icon={<PhoneCall size={14} />}
            />
          </div>
        </div>

        {activeTab === "chats" && (
          <div className={`${compactMode ? "px-3 pt-1.5" : "px-4 pt-2"}`}>
            <div className={`flex max-h-24 flex-wrap items-center gap-1.5 overflow-y-auto ${compactMode ? "pb-1.5" : "pb-2"}`}>
              {BUILTIN_FILTERS.map((item) => {
                const Icon = item.icon;
                const active = resolvedActiveFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveFilter(item.id)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      active
                        ? "border-violet-400/70 bg-violet-500/14 text-violet-700 dark:text-violet-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-violet-500/55 dark:hover:text-violet-200"
                    }`}
                  >
                    <Icon size={12} />
                    {item.label}
                  </button>
                );
              })}

              {customFilters.map((filter) => {
                const active = resolvedActiveFilter === filter.id;
                return (
                  <div key={filter.id} className={`inline-flex items-center overflow-hidden rounded-full border ${
                    active
                      ? "border-violet-400/70 bg-violet-500/14"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/80"
                  }`}>
                    <button
                      type="button"
                      onClick={() => setActiveFilter(filter.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        active
                          ? "text-violet-700 dark:text-violet-200"
                          : "text-slate-600 hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-200"
                      }`}
                    >
                      <Bookmark size={11} />
                      {filter.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCustomFilter(filter.id)}
                      className="border-l border-slate-200 px-1.5 py-1.5 text-slate-400 transition hover:text-rose-500 dark:border-slate-700 dark:text-slate-500 dark:hover:text-rose-300"
                      aria-label={`Remove ${filter.name}`}
                      title={`Remove ${filter.name}`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={openCreateFilter}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[12px] font-semibold transition duration-200 active:scale-[0.97] ${
                  createFilterOpen
                    ? "border-accent bg-accent text-white shadow-[0_10px_26px_rgb(var(--accent-500-rgb)_/_0.35)] ring-1 ring-[color:var(--accent-ring)] hover:brightness-110"
                    : (isDarkTheme
                      ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/9 hover:text-white"
                      : "border-slate-300/70 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900")
                }`}
                aria-label="Create custom list"
              >
                <PlusCircle size={12} />
                List
              </button>
            </div>
          </div>
        )}

        {activeTab === "chats" && hiddenChatsCount > 0 && (
          <div className="space-y-2 px-4 pb-2">
            {!hiddenChatsUnlocked && (
              <div className="flex items-center justify-between rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/12 dark:text-amber-200">
                <span>Type PIN in search to view hidden chats</span>
                <span>{hiddenChatsCount}</span>
              </div>
            )}

            {hiddenChatsUnlocked && hiddenChats.length > 0 && (
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/75 p-2 dark:border-slate-700/80 dark:bg-slate-900/65">
                {hiddenChats.map((chat) => (
                  <div key={chat.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/85 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/80">
                    <button
                      type="button"
                      onClick={() => onSelectChat?.(chat)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {chat.other_user_name || "Hidden chat"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {chat.last_message_body || "Hidden with PIN"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUnhideChat?.(chat.id)}
                      className="rounded-lg border border-violet-300/70 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-500/12 dark:text-violet-200 dark:hover:bg-violet-500/20"
                    >
                      Unhide
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "chats" && search.trim().length > 1 && (
          <section className="border-b border-slate-200/70 px-4 pb-3 dark:border-slate-800/70">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">People</p>
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {searchingPeople && <p className="text-xs text-slate-500 dark:text-slate-400">Searching...</p>}
              {!searchingPeople && !peopleResults.length && (
                <p className="text-xs text-slate-500 dark:text-slate-400">No users found</p>
              )}
              {!searchingPeople && peopleResults.map((person) => {
                const contact = (person.mobile || person.email || "").toString();
                const statusUpdatedAtMs = (() => {
                  const raw = person.status_updated_at;
                  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
                  if (typeof raw === "string" && raw) {
                    const parsed = new Date(raw).getTime();
                    return Number.isFinite(parsed) ? parsed : 0;
                  }
                  return 0;
                })();
                const onlineFresh = statusUpdatedAtMs ? (nowMs - statusUpdatedAtMs < 2 * 60 * 1000) : false;
                const online = showOnlineStatus && person.status === "online" && onlineFresh;
                let statusLabel = "";

                if (showOnlineStatus) {
                  if (online) statusLabel = "online";
                  else if (person.last_seen) {
                    const day = formatDayLabel(person.last_seen);
                    const time = formatTime(person.last_seen);
                    statusLabel = day === "Today" && time
                      ? `last seen ${time}`
                      : (day ? `last seen ${day}` : "offline");
                  } else {
                    statusLabel = "offline";
                  }
                }

                const detailLine = [contact, statusLabel].filter(Boolean).join(" • ");

                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onStartChat?.(person.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-700 dark:hover:bg-slate-800"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="relative">
                        <Avatar name={person.name} src={person.avatar_url} size={30} />
                        {showOnlineStatus && online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-100">{person.name}</span>
                        <span className={`block truncate text-[11px] ${online ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                          {detailLine}
                        </span>
                      </span>
                    </span>
                    <span className="rounded-lg bg-violet-500/15 p-1 text-violet-600 dark:text-violet-400">
                      <Plus size={13} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div
          ref={sliderRef}
          className="relative min-h-0 flex-1 overflow-hidden"
          onTouchStart={handleTabSwipeStart}
          onTouchMove={handleTabSwipeMove}
          onTouchEnd={handleTabSwipeEnd}
          onTouchCancel={handleTabSwipeEnd}
        >
          <div
            className={`flex h-full will-change-transform ${dragging ? "" : "transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"}`}
            style={{ transform: `translate3d(calc(${-activeTabIndex * 100}% + ${dragOffset}px), 0, 0)` }}
          >
            <section className="min-w-full flex min-h-0 flex-1 flex-col">
              <div className="px-4 py-2">
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${sidebarLabelClass}`}>Chats</p>
              </div>
              <div className={`chat-scroll min-h-0 flex-1 overflow-y-auto ${compactMode ? "px-1.5" : "px-2"} pb-[max(4.25rem,env(safe-area-inset-bottom))]`}>
                {loadingChats ? (
                  <ChatListSkeleton />
                ) : filteredChats.length ? (
                  <div className="space-y-1.5">
                    {filteredChats.map((chat) => (
                      <ChatListItem
                        key={chat.id}
                        chat={chat}
                        active={chat.id === activeChatId}
                        unreadCount={unreadByChat[chat.id] || 0}
                        onClick={onSelectChat}
                        compactMode={compactMode}
                        showOnlineStatus={showOnlineStatus}
                        customDark={customSidebarDark}
                        nowMs={nowMs}
                      />
                    ))}
                  </div>
                ) : (
                  <p className={`px-3 py-2 text-sm ${sidebarLabelClass}`}>No chats in this filter.</p>
                )}
              </div>
            </section>

            <section className="min-w-full flex min-h-0 flex-1 flex-col">
              <div className="px-4 py-2">
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${sidebarLabelClass}`}>Status</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {/* WhatsApp-like status layout (inspired, not identical). */}
                <button
                  type="button"
                  onClick={() => {
                    if (anaUpdates.length) setStatusViewerOpen(true);
                    else {
                      // Focus the status composer area if no update exists.
                      setAnaUpdateText((v) => v);
                    }
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                    isDarkTheme ? "border-slate-700 bg-slate-950/40 hover:bg-slate-900/50" : "border-slate-200 bg-white/80 hover:bg-slate-50"
                  }`}
                  aria-label="Open my status"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative">
                      <Avatar name={me?.name || "Me"} src={me?.avatar_url} size={44} />
                      <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-accent text-white shadow-accent">
                        <Plus size={14} />
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">My status</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {myStatus.text ? myStatus.text : (anaUpdates.length ? "Tap to view updates" : "Tap to add status update")}
                      </span>
                      {myStatus.updatedAt && (
                        <span className="mt-0.5 block truncate text-[11px] text-slate-400 dark:text-slate-500">
                          Updated {formatDayLabel(myStatus.updatedAt)} {formatTime(myStatus.updatedAt) ? `• ${formatTime(myStatus.updatedAt)}` : ""}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-600 transition hover:bg-white/10 dark:text-slate-200/85">
                      <Camera size={16} />
                    </span>
                  </span>
                </button>

                <div className="mt-4">
                  <p className={`mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${sidebarLabelClass}`}>Recent updates</p>
                  {statusChats.length ? (
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {statusChats.slice(0, 12).map((chat) => (
                        <button
                          key={chat.id}
                          type="button"
                          onClick={() => openContactStatus(chat)}
                          className="group w-[78px] shrink-0 text-left"
                          aria-label={`Open status ${chat.other_user_name || "User"}`}
                        >
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[conic-gradient(from_220deg,rgb(var(--accent-500-rgb)_/_0.95),rgb(var(--accent-300-rgb)_/_0.85),rgb(var(--accent-700-rgb)_/_0.9))] p-[2px] shadow-[0_12px_28px_rgb(var(--accent-500-rgb)_/_0.20)] transition group-hover:brightness-110">
                            <div className="h-full w-full rounded-full bg-slate-950/50 p-[2px]">
                              <Avatar name={chat.other_user_name || "User"} src={chat.other_user_avatar} size={52} />
                            </div>
                          </div>
                          <p className="mt-2 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {chat.other_user_name || "Unknown"}
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {formatDayLabel(chat.other_user_last_seen) === "Today"
                              ? (formatTime(chat.other_user_last_seen) || "Today")
                              : (formatDayLabel(chat.other_user_last_seen) || "Recent")}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={`rounded-xl border px-3 py-2 text-sm ${sidebarLabelClass} ${
                      isDarkTheme ? "border-slate-700 bg-slate-950/40" : "border-slate-200 bg-white/80"
                    }`}>
                      No contacts yet. Start a chat to see status updates.
                    </p>
                  )}
                </div>

                <div className={`mt-4 rounded-2xl border p-3 ${
                  isDarkTheme ? "border-slate-700 bg-slate-950/40" : "border-slate-200 bg-white/80"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">AnaUpdate</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Post text, images, or videos</p>
                  </div>

                  <textarea
                    value={anaUpdateText}
                    onChange={(e) => setAnaUpdateText(e.target.value)}
                    rows={3}
                    placeholder="Share an update..."
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-violet-500"
                  />

                  {anaUpdateMedia && (
                    <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {anaUpdateMedia.name || (anaUpdateMedia.type === "video" ? "Video" : "Image")}
                          {anaUpdateMedia.transient ? " (won't persist after refresh)" : ""}
                        </p>
                        <button
                          type="button"
                          onClick={clearAnaUpdateMedia}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Remove
                        </button>
                      </div>
                      {anaUpdateMedia.type === "image" && (anaUpdateMedia.dataUrl || anaUpdateMedia.url) && (
                        <img
                          src={anaUpdateMedia.dataUrl || anaUpdateMedia.url}
                          alt="AnaUpdate"
                          className="mt-2 max-h-56 w-full rounded-xl object-cover"
                        />
                      )}
                      {anaUpdateMedia.type === "video" && anaUpdateMedia.url && (
                        <video src={anaUpdateMedia.url} controls className="mt-2 max-h-56 w-full rounded-xl" />
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => imagePickerRef.current?.click()}
                      className="btn-secondary rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      Add image
                    </button>
                    <button
                      type="button"
                      onClick={() => videoPickerRef.current?.click()}
                      className="btn-secondary rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      Add video
                    </button>
                    <button
                      type="button"
                      onClick={postAnaUpdate}
                      disabled={!anaUpdateMedia && !(anaUpdateText || "").toString().trim()}
                      className="btn-primary ml-auto rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Post
                    </button>
                  </div>

                  <input
                    ref={imagePickerRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePickedImage(e.target.files?.[0] || null)}
                  />
                  <input
                    ref={videoPickerRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => handlePickedVideo(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${sidebarLabelClass}`}>My AnaUpdates</p>
                    {anaUpdates.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAnaUpdates}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {anaUpdates.length === 0 ? (
                    <p className={`mt-2 rounded-xl border px-3 py-2 text-sm ${sidebarLabelClass} ${
                      isDarkTheme ? "border-slate-700 bg-slate-950/40" : "border-slate-200 bg-white/80"
                    }`}>
                      No updates yet. Post your first AnaUpdate above.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {anaUpdates.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-2xl border p-3 ${
                            isDarkTheme ? "border-slate-700 bg-slate-950/40" : "border-slate-200 bg-white/80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {formatDayLabel(item.created_at)} {formatTime(item.created_at) ? `• ${formatTime(item.created_at)}` : ""}
                              </p>
                              <button
                                type="button"
                                onClick={() => openStatusViewerById(item.id)}
                                className="mt-1 block w-full text-left"
                                aria-label="Open status"
                                title="Open status"
                              >
                                {item.text && (
                                  <p className="whitespace-pre-wrap text-sm text-slate-800 hover:opacity-95 dark:text-slate-100">
                                    {item.text}
                                  </p>
                                )}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAnaUpdate(item.id)}
                              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Delete
                            </button>
                          </div>

                          {item.mediaType === "image" && item.mediaDataUrl && (
                            <button
                              type="button"
                              onClick={() => openStatusViewerById(item.id)}
                              className="mt-2 block w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
                              aria-label="Open status media"
                              title="Open status"
                            >
                              <img src={item.mediaDataUrl} alt="AnaUpdate" className="max-h-64 w-full object-cover transition hover:brightness-105" loading="lazy" decoding="async" />
                            </button>
                          )}
                          {item.mediaType === "video" && item.mediaUrl && (
                            <button
                              type="button"
                              onClick={() => openStatusViewerById(item.id)}
                              className="mt-2 block w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
                              aria-label="Open status video"
                              title="Open status"
                            >
                              <video src={item.mediaUrl} className="max-h-64 w-full rounded-xl" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${sidebarLabelClass}`}>Contacts</p>
                  {statusChats.length === 0 ? (
                    <p className={`rounded-xl border px-3 py-2 text-sm ${sidebarLabelClass} ${
                      isDarkTheme ? "border-slate-700 bg-slate-950/40" : "border-slate-200 bg-white/80"
                    }`}>
                      No contacts yet. Start a chat to see status updates.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {statusChats.map((chat) => (
                        <button
                          key={chat.id}
                          type="button"
                          onClick={() => onSelectChat?.(chat)}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                            isDarkTheme
                              ? "border-slate-700 bg-slate-950/40 hover:bg-slate-900/50"
                              : "border-slate-200 bg-white/80 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <Avatar
                              name={chat.other_user_name || "User"}
                              src={chat.other_user_avatar}
                              size={38}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {chat.other_user_name || "Unknown"}
                              </span>
                              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                {(chat.other_user_status || chat.other_user_about || "No status update").toString()}
                              </span>
                            </span>
                          </span>
                          {showOnlineStatus && chat.other_user_last_seen && (
                            <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                              {formatDayLabel(chat.other_user_last_seen) === "Today"
                                ? (formatTime(chat.other_user_last_seen) || "")
                                : (formatDayLabel(chat.other_user_last_seen) || "")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="min-w-full flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between px-4 py-2">
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${sidebarLabelClass}`}>Call logs</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenCallLogs?.()}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Open
                  </button>
                  {callLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearCallLogs();
                        setCallLogs([]);
                      }}
                      className="rounded-xl border border-rose-300/70 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {callLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No calls yet</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your recent calls will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {callLogGroups.map(([day, items]) => (
                      <div key={day}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{day}</p>
                        <div className="space-y-2">
                          {items.map((item) => {
                            const incoming = item.direction === "incoming";
                            const callType = item.callType === "video" ? "video" : "voice";
                            const when = formatTime(item.started_at || item.created_at) || "";
                            const dur = durationLabel(item.started_at, item.ended_at);
                            const status = callStatusLabel(item);
                            const statusTone = ["missed", "rejected", "busy", "no_answer"].includes(item.status)
                              ? "text-rose-600 dark:text-rose-300"
                              : "text-slate-600 dark:text-slate-300";

                            const CallDirIcon = incoming ? PhoneIncoming : PhoneOutgoing;
                            const CallTypeIcon = callType === "video" ? Video : PhoneCall;

                            return (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 shadow-sm transition ${
                                  isDarkTheme ? "border-slate-700 bg-slate-950/40 hover:bg-slate-900/50" : "border-slate-200 bg-white/80 hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <Avatar name={item.peerName || "Unknown"} src={item.peerAvatar} size={40} />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.peerName || "Unknown"}</p>
                                    <p className={`flex items-center gap-1.5 truncate text-xs ${statusTone}`}>
                                      <span className="inline-flex items-center gap-1">
                                        <CallDirIcon size={14} className="shrink-0 opacity-80" />
                                        <CallTypeIcon size={14} className="shrink-0 opacity-80" />
                                      </span>
                                      <span className="truncate">
                                        {status}{dur ? ` • ${dur}` : ""}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                                <div className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{when}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {activeTab === "chats" && quickActionsOpen && (
          <button
            type="button"
            onClick={() => setQuickActionsOpen(false)}
            className="absolute inset-0 z-[18] bg-slate-950/25"
            aria-label="Close quick actions"
          />
        )}

        {activeTab === "chats" && (
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-[25] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${compactMode ? "sm:p-2.5" : ""}`}>
            <div ref={quickActionsRef} className="pointer-events-auto ml-auto w-full">
              {quickActionsOpen && (
                <div className={`mb-2 w-full rounded-2xl border p-2.5 shadow-2xl ${
                  isDarkTheme
                    ? "border-slate-700 bg-slate-950/96"
                    : "border-slate-300 bg-white/98"
                }`}>
                  <p className={`mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    isDarkTheme ? "text-slate-400" : "text-slate-500"
                  }`}>
                    Quick actions
                  </p>

                  <label className="relative block">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    />
                    <input
                      value={search}
                      onChange={(event) => onSearch(event.target.value)}
                      placeholder="Search chats/users or enter PIN"
                      className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 ${
                        isDarkTheme
                          ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/25"
                          : "border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/25"
                      }`}
                      aria-label="Search chats or users"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickActionsOpen(false);
                      onCreateGroup?.();
                    }}
                    className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      isDarkTheme
                        ? "border-violet-500/40 bg-violet-500/12 text-violet-100 hover:bg-violet-500/20"
                        : "border-violet-500/45 bg-violet-500 text-white hover:bg-violet-600"
                    }`}
                  >
                    <UsersRound size={16} />
                    New group
                  </button>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setQuickActionsOpen((prev) => !prev)}
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-full border text-white shadow-[0_16px_35px_rgba(14,116,144,0.35)] transition ${
                    quickActionsOpen
                      ? "border-rose-400/60 bg-gradient-to-br from-rose-500 to-orange-500"
                      : "border-violet-400/55 bg-gradient-to-br from-fuchsia-500 via-violet-500 to-slate-950 hover:brightness-110"
                  }`}
                  aria-label={quickActionsOpen ? "Close quick actions" : "Open quick actions"}
                  title={quickActionsOpen ? "Close" : "Quick actions"}
                >
                  <Plus size={20} className={`${quickActionsOpen ? "rotate-45" : ""} transition-transform`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {createFilterOpen && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-5">
          <button
            type="button"
            onClick={closeCreateFilter}
            className="absolute inset-0 bg-slate-950/60"
            aria-label="Close custom filter dialog"
          />

          <div className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Custom filter</p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create chat filter</h3>
              </div>
              <button
                type="button"
                onClick={closeCreateFilter}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">List name</span>
              <input
                value={newFilterName}
                onChange={(event) => {
                  setNewFilterName(event.target.value);
                  setFilterError("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-500"
                placeholder="Friends, Team, Priority"
              />
            </label>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {sourceChats.length ? (
                <div className="space-y-1.5">
                  {sourceChats.map((chat) => {
                    const checked = Boolean(selectedChatIds[chat.id]);
                    return (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => toggleChatForFilter(chat.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left transition ${
                          checked
                            ? "border-violet-400 bg-violet-50 dark:border-violet-500/45 dark:bg-violet-500/15"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={chat.other_user_name || chat.group_name} src={chat.other_user_avatar || chat.group_avatar_url} size={30} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                              {chat.other_user_name || chat.group_name || "Unknown"}
                            </span>
                            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {chat.chat_type === "group" ? "Group" : "Personal"}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold ${
                            checked
                              ? "border-violet-500 bg-violet-500 text-white"
                              : "border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500"
                          }`}
                        >
                          {checked ? "OK" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="px-2 py-1 text-sm text-slate-500 dark:text-slate-400">No chats available.</p>
              )}
            </div>

            {filterError && (
              <p className="mt-2 rounded-lg border border-rose-300/70 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {filterError}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveCustomFilter}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-600"
              >
                Save list
              </button>
              <button
                type="button"
                onClick={closeCreateFilter}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <StatusViewerModal
        open={statusViewerOpen}
        items={anaUpdates}
        index={statusViewerIndex}
        me={me}
        onClose={() => setStatusViewerOpen(false)}
        onNavigate={(idx) => setStatusViewerIndex(Math.max(0, Math.min(idx, anaUpdates.length - 1)))}
      />

      <StatusViewerModal
        open={contactStatusViewerOpen}
        items={contactStatusViewerData?.items || []}
        index={0}
        me={me}
        headerName={contactStatusViewerData?.name || ""}
        headerAvatar={contactStatusViewerData?.avatar || null}
        headerSubtitle={contactStatusViewerData?.subtitle || ""}
        onClose={() => {
          setContactStatusViewerOpen(false);
          setContactStatusViewerData(null);
        }}
        onNavigate={() => {}}
      />
    </>
  );
}

function TabButton({ active, label, onClick, onHover, icon, badgeCount = 0, hasCustomColor, isSidebarLight }) {
  const showBadge = Number(badgeCount) > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-2xl px-2.5 py-2 text-xs font-semibold transition ${
        active
          ? "text-accent"
          : (hasCustomColor
            ? (isSidebarLight
              ? "text-slate-600 hover:bg-accent-soft hover:text-slate-900"
              : "text-white/80 hover:bg-accent-soft hover:text-white")
            : "text-slate-600 hover:bg-accent-soft hover:text-slate-900 dark:text-slate-300 dark:hover:bg-accent-soft dark:hover:text-white")
      }`}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {icon}
      <span className="inline-flex items-center gap-1.5">
        {label}
        {showBadge && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {Math.min(99, Number(badgeCount))}
          </span>
        )}
      </span>
    </button>
  );
}
