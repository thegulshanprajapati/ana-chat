import { useEffect, useMemo, useState } from "react";
import { 
  X, Search, Star, Bell, Clock, Heart, 
  Trash2, Flag, UserMinus, UserCheck, Folder, Download, 
  Trash, Ban, ThumbsDown, Pencil, ChevronDown, Check,
  FileText, ExternalLink, Play, Lock
} from "lucide-react";
import Avatar, { avatarUrl } from "../common/Avatar";
import PhotoViewer from "../common/PhotoViewer";
import { formatDayLabel, formatTime } from "../../utils/time";
import { api, API_BASE_URL } from "../../api/client";
import { mediaSrc, isVideoMedia } from "../../utils/chat";
import CustomConfirmDialog from "../common/CustomConfirmDialog";
import { useToast } from "../../context/ToastContext";
import { clearLocalMessagesForChat } from "../../utils/localDb";
import RelationshipSection from "../profile/RelationshipSection";
import CoupleSecretRoomModal from "./CoupleSecretRoomModal";

const REPORT_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abuse" },
  { id: "harassment", label: "Harassment" },
  { id: "fake_profile", label: "Fake profile" },
  { id: "scam", label: "Scam" },
  { id: "other", label: "Other" }
];

function deriveUsername(partner) {
  const explicit = (partner?.username || "").toString().trim();
  if (explicit) return explicit.startsWith("@") ? explicit : `@${explicit}`;

  const email = (partner?.email || "").toString().trim();
  if (email && email.includes("@")) return `@${email.split("@")[0]}`;

  const mobile = (partner?.mobile || "").toString().replace(/\D/g, "");
  if (mobile) return `@user${mobile.slice(-6)}`;

  if (partner?.id) return `@user${partner.id}`;
  return "@user";
}

function lastActiveText(partner, nowMs, isGroup = false, memberCount = 0) {
  if (isGroup) return memberCount ? `${memberCount} members` : "Group chat";

  const statusUpdatedAtMs = (() => {
    const raw = partner?.status_updated_at;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw) {
      const parsed = new Date(raw).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  })();
  const onlineFresh = statusUpdatedAtMs ? (Number(nowMs) - statusUpdatedAtMs < 2 * 60 * 1000) : false;
  if (partner?.status === "online" && onlineFresh) return "Online now";
  if (!partner?.last_seen) return "Last active unavailable";

  const day = formatDayLabel(partner.last_seen);
  const time = formatTime(partner.last_seen);
  if (!day || !time) return "Last active unavailable";
  if (day === "Today") return `Last active today at ${time}`;
  if (day === "Yesterday") return `Last active yesterday at ${time}`;
  return `Last active ${day}, ${time}`;
}

export default function PartnerProfileSheet({
  open,
  onClose,
  partner,
  isGroup = false,
  memberCount = 0,
  blockedByMe = false,
  blockedMe = false,
  blockActionBusy = false,
  onBlockUser,
  onUnblockUser,
  onReportUser,
  reportBusy = false,
  meId,
  chatId,
  messages = [],
  onSearchOpen,
  onDeleteChat,
  theme = "dark",
  socket = null
}) {
  const { success, error: showToastError } = useToast();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [secretRoomOpen, setSecretRoomOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false);

  // Real localStorage states
  const [isFavourite, setIsFavourite] = useState(false);
  const [muted, setMuted] = useState(false);
  const [disappearingDuration, setDisappearingDuration] = useState(0); // 0 = off, 3600 = 1hr, 86400 = 24hr
  const [disappearingOpen, setDisappearingOpen] = useState(false);

  const isDark = theme === "dark";

  const username = useMemo(() => deriveUsername(partner), [partner]);
  const statusLine = useMemo(() => lastActiveText(partner, nowMs, isGroup, memberCount), [isGroup, memberCount, nowMs, partner]);
  const online = useMemo(() => statusLine === "Online now", [statusLine]);
  const profilePhotoSrc = useMemo(() => avatarUrl(partner?.avatar_url), [partner?.avatar_url]);

  // Read state from local storage and sync on events
  useEffect(() => {
    if (!meId || !chatId) return;
    const handleSync = () => {
      try {
        // Favourites
        const favs = JSON.parse(localStorage.getItem(`ana_favourite_chats_${meId}`) || "[]");
        setIsFavourite(favs.map(String).includes(String(chatId)));

        // Muted
        const mutes = JSON.parse(localStorage.getItem(`ana_muted_chats_${meId}`) || "[]");
        setMuted(mutes.map(String).includes(String(chatId)));

        // Disappearing duration
        const disaps = JSON.parse(localStorage.getItem(`ana_disappearing_chats_${meId}`) || "{}");
        setDisappearingDuration(Number(disaps[chatId]) || 0);
      } catch (e) {
        // ignore
      }
    };
    handleSync();
    window.addEventListener("ana_chats_updated", handleSync);
    return () => window.removeEventListener("ana_chats_updated", handleSync);
  }, [meId, chatId, open]);

  // Toggle Favourite
  const handleToggleFavourite = () => {
    if (!meId || !chatId) return;
    try {
      const key = `ana_favourite_chats_${meId}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      let next;
      const cidStr = String(chatId);
      if (list.map(String).includes(cidStr)) {
        next = list.filter(id => String(id) !== cidStr);
        setIsFavourite(false);
      } else {
        next = [...list, chatId];
        setIsFavourite(true);
      }
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("ana_chats_updated"));
    } catch (e) {
      // ignore
    }
  };

  // Toggle Mute Notifications
  const handleToggleMute = () => {
    if (!meId || !chatId) return;
    try {
      const key = `ana_muted_chats_${meId}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      let next;
      const cidStr = String(chatId);
      if (list.map(String).includes(cidStr)) {
        next = list.filter(id => String(id) !== cidStr);
        setMuted(false);
      } else {
        next = [...list, chatId];
        setMuted(true);
      }
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("ana_chats_updated"));
    } catch (e) {
      // ignore
    }
  };

  // Set Disappearing Duration
  const handleSetDisappearing = (durationValue) => {
    if (!meId || !chatId) return;
    try {
      const key = `ana_disappearing_chats_${meId}`;
      const currentConfig = JSON.parse(localStorage.getItem(key) || "{}");
      if (durationValue === 0) {
        delete currentConfig[chatId];
      } else {
        currentConfig[chatId] = durationValue;
      }
      localStorage.setItem(key, JSON.stringify(currentConfig));
      setDisappearingDuration(durationValue);
      setDisappearingOpen(false);
      window.dispatchEvent(new Event("ana_chats_updated"));
    } catch (e) {
      // ignore
    }
  };

  // Clear Chat function
  const handleClearChat = () => {
    if (!chatId) return;
    setConfirmClearOpen(true);
  };

  const performClearChat = async () => {
    setConfirmClearOpen(false);
    try {
      await api.post(`/chats/${chatId}/clear`);
      await clearLocalMessagesForChat(chatId, meId).catch(() => {});
      window.dispatchEvent(new Event("ana_chats_updated"));
      window.dispatchEvent(new CustomEvent("ana_active_chat_cleared", { detail: { chatId } }));
      success("Chat cleared successfully.");
    } catch (err) {
      showToastError(err.response?.data?.message || "Failed to clear chat.");
    }
  };

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(partner?.name || "");
  const [activeTab, setActiveTab] = useState("media");

  useEffect(() => {
    setTempName(partner?.name || "");
  }, [partner?.name]);

  // Rename Contact function
  const handleRenameContact = async () => {
    if (!partner?.id) return;
    if (isEditingName) {
      if (tempName.trim() && tempName.trim() !== partner?.name) {
        try {
          await api.patch(`/users/${partner.id}/rename`, { name: tempName.trim() });
          window.dispatchEvent(new Event("ana_chats_updated"));
          success("Contact renamed successfully.");
        } catch (err) {
          showToastError(err.response?.data?.message || "Failed to rename contact.");
        }
      }
      setIsEditingName(false);
    } else {
      setIsEditingName(true);
    }
  };

  const handleCopyUsername = () => {
    if (!username) return;
    navigator.clipboard.writeText(username);
    success("Username copied to clipboard!");
  };

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Helper to extract a filename
  const getDocName = (item) => {
    const explicit = item.e2ee?.media?.name;
    if (explicit) return explicit;
    const url = item.image_url || "";
    const parts = url.split("/");
    const last = parts[parts.length - 1];
    return last || "document";
  };

  // Filter messages that have media (images & videos)
  const mediaItems = useMemo(() => {
    if (!messages) return [];
    return messages.filter(m => {
      if (m.deleted_for_everyone || !m.image_url) return false;
      const kind = m.e2ee?.media?.kind;
      if (kind === "image" || kind === "video") return true;
      if (!kind) {
        const url = (m.image_url || "").toLowerCase();
        const isVid = /\.(mp4|mov|webm|m4v|ogg|avi|mkv)$/i.test(url);
        const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url);
        return isVid || isImg;
      }
      return false;
    });
  }, [messages]);

  // Filter documents/files
  const docItems = useMemo(() => {
    if (!messages) return [];
    return messages.filter(m => {
      if (m.deleted_for_everyone || !m.image_url) return false;
      const kind = m.e2ee?.media?.kind;
      if (kind === "file" || kind === "audio") return true;
      if (!kind) {
        const url = (m.image_url || "").toLowerCase();
        const isVid = /\.(mp4|mov|webm|m4v|ogg|avi|mkv)$/i.test(url);
        const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url);
        return !isVid && !isImg;
      }
      return false;
    });
  }, [messages]);

  // Filter messages containing links
  const linkItems = useMemo(() => {
    if (!messages) return [];
    return messages.filter(m => {
      if (m.deleted_for_everyone || !m.body) return false;
      return /https?:\/\/[^\s]+/i.test(m.body);
    });
  }, [messages]);

  const totalCount = mediaItems.length + docItems.length + linkItems.length;

  if (!open) return null;

  const phoneDisplay = partner?.mobile || partner?.phone || "No phone added";

  // Disappearing label helper
  const disappearingLabel = () => {
    if (disappearingDuration === 3600) return "1 hr after seen";
    if (disappearingDuration === 86400) return "24 hr";
    return "Off";
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-stretch justify-end select-none">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 transition-opacity"
        aria-label="Close profile panel"
      />

      {/* Drawer Container (Adapts perfectly to Light/Dark Mode) */}
      <aside className={`relative z-10 flex h-full w-full max-w-md flex-col border-l transition-transform duration-300 shadow-2xl ${
        isDark 
          ? "border-[var(--panel-border)] bg-[var(--panel-bg)] text-slate-100" 
          : "border-slate-200 bg-[#f0f2f5] text-slate-800"
      }`}>
        
        {/* Header */}
        <div className={`flex h-[64px] items-center justify-between px-6 ${
          isDark ? "bg-[var(--panel-bg-2)] text-slate-200" : "bg-[#f0f2f5] text-slate-700 border-b border-slate-200"
        }`}>
          <div className="flex-1 flex items-center gap-4 min-w-0 mr-2">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-full p-1.5 transition-colors shrink-0 ${
                isDark ? "hover:bg-[var(--accent-soft-18)]" : "hover:bg-slate-200"
              }`}
              aria-label="Close"
            >
              <X size={20} className={isDark ? "text-[var(--panel-muted)]" : "text-slate-600"} />
            </button>
            {isEditingName ? (
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameContact();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                autoFocus
                className="flex-1 min-w-0 bg-transparent border-b outline-none text-sm px-1 py-0.5"
                style={{
                  borderColor: "var(--accent)",
                  color: "var(--text-primary)"
                }}
              />
            ) : (
              <span className="text-base font-semibold truncate">Contact info</span>
            )}
          </div>
          <button 
            type="button"
            onClick={handleRenameContact}
            className={`rounded-full p-1.5 transition-colors ${
              isDark ? "hover:bg-[var(--accent-soft-18)]" : "hover:bg-slate-200"
            }`}
            aria-label={isEditingName ? "Save name" : "Rename contact"}
          >
            {isEditingName ? (
              <Check size={18} style={{ color: "var(--accent)" }} />
            ) : (
              <Pencil size={18} className={isDark ? "text-[var(--panel-muted)]" : "text-slate-600"} />
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className={`min-h-0 flex-1 overflow-y-auto space-y-2 pb-6 ${
          isDark ? "bg-[var(--body-bg-dark)]" : "bg-[#f0f2f5]"
        }`}>
          
          {/* Main User Block */}
          <div className={`px-6 py-7 flex flex-col items-center border-b ${
            isDark ? "bg-[var(--panel-bg)] border-[var(--panel-border)]" : "bg-[#ffffff] border-slate-200"
          }`}>
            {/* Large Avatar */}
            <div className="relative mb-5">
              <button
                type="button"
                onClick={() => profilePhotoSrc && setProfilePhotoOpen(true)}
                disabled={!profilePhotoSrc}
                className={`rounded-full ${profilePhotoSrc ? "cursor-zoom-in" : "cursor-default"}`}
                aria-label={profilePhotoSrc ? "Open full profile photo" : "Profile photo unavailable"}
              >
                <Avatar name={partner?.name} src={partner?.avatar_url} size={150} />
              </button>
              {online && (
                <div className={`absolute bottom-2 right-2 w-4 h-4 rounded-full bg-emerald-500 border-4 ${
                  isDark ? "border-[var(--panel-bg)]" : "border-[#ffffff]"
                }`} />
              )}
            </div>
            {/* Name */}
            <h2 className={`text-[21px] font-normal leading-tight text-center ${
              isDark ? "text-[var(--panel-text)]" : "text-slate-900"
            }`}>
              {partner?.name || "Unknown"}
            </h2>
            {/* Phone/Sub */}
            <p className={`mt-1.5 text-[14px] text-center select-text selection:bg-accent/30 selection:text-accent-hover ${
              isDark ? "text-[var(--panel-muted)]" : "text-slate-500"
            }`}>
              {phoneDisplay}
            </p>
            {/* Username */}
            <p
              onClick={handleCopyUsername}
              className="mt-1 text-xs text-accent cursor-pointer hover:underline active:scale-95 transition-transform"
              title="Click to copy username"
            >
              {username}
            </p>

            {/* Relationship badge */}
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold select-none ${
                (partner?.relationship_status === "relationship" || partner?.relationship_status === "in_relationship") 
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  : partner?.relationship_status === "married"
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  : partner?.relationship_status === "engaged"
                  ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                  : partner?.relationship_status === "single"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                <Heart size={12} className={(partner?.relationship_status === "relationship" || partner?.relationship_status === "in_relationship" || partner?.relationship_status === "married") ? "fill-current animate-pulse text-rose-500" : ""} />
                Status: {partner?.relationship_status && typeof partner.relationship_status === "string"
                  ? (partner.relationship_status === "in_relationship" ? "In a Relationship" : partner.relationship_status.charAt(0).toUpperCase() + partner.relationship_status.slice(1))
                  : "Not set"}
              </span>
              {partner?.partner_user_id && (
                <span className="text-[10px] text-slate-400">Linked Partner ID: {partner.partner_user_id}</span>
              )}
            </div>

            {/* Couple Secret Room launcher button (only if linked couple) */}
            {Boolean(partner?.id && meId && String(partner.partner_user_id) === String(meId)) && (
              <button
                type="button"
                onClick={() => setSecretRoomOpen(true)}
                className="mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-[0_4px_20px_rgba(244,63,94,0.35)] transition active:scale-95"
              >
                <Lock size={13} /> Open Ephemeral Secret Room 🔐
              </button>
            )}

            {/* Action Buttons (Search) */}
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onSearchOpen}
                className="group flex flex-col items-center gap-2 text-center"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  isDark ? "bg-[var(--panel-bg-2)] text-accent hover:bg-[var(--accent-soft-18)]" : "bg-slate-100 text-accent hover:bg-slate-200"
                }`}>
                  <Search size={18} />
                </div>
                <span className={`text-[12px] transition-colors ${
                  isDark ? "text-[var(--panel-muted)] group-hover:text-slate-200" : "text-slate-500 group-hover:text-slate-800"
                }`}>Search</span>
              </button>
            </div>
          </div>

          {/* About / Bio section */}
          {!isGroup && (
            <div className={`px-6 py-4 space-y-1 ${
              isDark ? "bg-[var(--panel-bg)]" : "bg-[#ffffff] border-b border-slate-200"
            }`}>
              <span className={`text-[13px] ${isDark ? "text-[var(--panel-muted)]" : "text-slate-500"}`}>About</span>
              <p className={`text-[14px] leading-normal break-words whitespace-pre-wrap ${
                isDark ? "text-[var(--panel-text)]" : "text-slate-800"
              }`}>
                {(partner?.about || "").toString().trim() || "Hey there! I am using AnaChat."}
              </p>
            </div>
          )}

          {/* Media Links and Docs */}
          <div className={`px-6 py-4 space-y-3 ${
            isDark ? "bg-[var(--panel-bg)]" : "bg-[#ffffff] border-b border-slate-200"
          }`}>
            <div className={`flex items-center justify-between text-[14px] ${
              isDark ? "text-[var(--panel-muted)]" : "text-slate-500"
            }`}>
              <span className="flex items-center gap-2">
                <Folder size={16} />
                Media, links and docs
              </span>
              <span className="text-xs hover:underline cursor-pointer font-semibold text-accent">
                {totalCount}
              </span>
            </div>

            {/* Tab buttons */}
            <div className="flex border-b border-slate-200/40 dark:border-white/5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("media")}
                className={`pb-1.5 px-3 font-semibold transition-colors border-b-2 ${
                  activeTab === "media"
                    ? "border-accent text-accent"
                    : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                Media ({mediaItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("docs")}
                className={`pb-1.5 px-3 font-semibold transition-colors border-b-2 ${
                  activeTab === "docs"
                    ? "border-accent text-accent"
                    : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                Docs ({docItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("links")}
                className={`pb-1.5 px-3 font-semibold transition-colors border-b-2 ${
                  activeTab === "links"
                    ? "border-accent text-accent"
                    : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                Links ({linkItems.length})
              </button>
            </div>

            {/* Tab contents */}
            <div className="pt-1">
              {activeTab === "media" && (
                mediaItems.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
                    {mediaItems.map((item, idx) => {
                      const isVid = item.e2ee?.media?.kind === "video" || /\.(mp4|mov|webm|m4v|ogg|avi|mkv)$/i.test(item.image_url || "");
                      const resolvedUrl = mediaSrc(API_BASE_URL, item.image_url);
                      return (
                        <div key={item.id || idx} className="relative group shrink-0">
                          <img 
                            src={resolvedUrl} 
                            alt="chat-media" 
                            className={`w-[78px] h-[78px] object-cover rounded-lg ${
                              isDark ? "bg-[var(--panel-bg-2)]" : "bg-slate-100"
                            }`}
                          />
                          {isVid && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/35 rounded-lg">
                              <Play size={16} className="text-white fill-white" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 italic">No media shared</div>
                )
              )}

              {activeTab === "docs" && (
                docItems.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {docItems.map((item, idx) => {
                      const docName = getDocName(item);
                      const resolvedUrl = mediaSrc(API_BASE_URL, item.image_url);
                      return (
                        <a 
                          key={item.id || idx}
                          href={resolvedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-100/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition text-left"
                        >
                          <FileText size={16} className="text-accent shrink-0" />
                          <span className="text-xs font-medium truncate flex-1 text-slate-700 dark:text-slate-300">
                            {docName}
                          </span>
                          <Download size={14} className="text-slate-400 hover:text-white shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 italic">No documents shared</div>
                )
              )}

              {activeTab === "links" && (
                linkItems.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {linkItems.map((item, idx) => {
                      const match = item.body.match(/https?:\/\/[^\s]+/i);
                      const url = match ? match[0] : "#";
                      return (
                        <a 
                          key={item.id || idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-100/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition text-left"
                        >
                          <ExternalLink size={14} className="text-blue-500 shrink-0" />
                          <span className="text-xs font-medium truncate flex-1 text-blue-500 hover:underline">
                            {url}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 italic">No links shared</div>
                )
              )}
            </div>
          </div>

          {/* Core Settings Menu */}
          <div className={`divide-y ${
            isDark ? "bg-[var(--panel-bg)] divide-white/5 border-b border-white/5" : "bg-[#ffffff] divide-slate-100 border-b border-slate-200"
          }`}>
            {/* Starred Messages */}
            <div className={`flex items-center gap-5 px-6 py-4 cursor-pointer transition-colors ${
              isDark ? "hover:bg-[var(--accent-soft-10)] text-[#e9edef]" : "hover:bg-slate-50 text-slate-800"
            }`}>
              <Star size={20} className={isDark ? "text-[var(--panel-muted)]" : "text-slate-400"} />
              <div className="flex-1 text-[15px]">Starred messages</div>
            </div>

            {/* Mute Notifications */}
            <div className={`flex items-center gap-5 px-6 py-4 transition-colors ${
              isDark ? "hover:bg-[var(--accent-soft-10)] text-[#e9edef]" : "hover:bg-slate-50 text-slate-800"
            }`}>
              <Bell size={20} className={isDark ? "text-[var(--panel-muted)]" : "text-slate-400"} />
              <div className="flex-1 text-[15px]">Mute notifications</div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={muted} 
                  onChange={handleToggleMute} 
                  className="sr-only peer" 
                />
                <div 
                  className={`w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    isDark 
                      ? "bg-[var(--panel-bg-2)] after:bg-[#cfd6d9] peer-checked:after:bg-[#ffffff]" 
                      : "bg-slate-200 after:bg-white"
                  }`}
                  style={{ backgroundColor: muted ? "var(--accent)" : "" }}
                ></div>
              </label>
            </div>

            {/* Disappearing Messages */}
            <div className="relative">
              <div 
                onClick={() => setDisappearingOpen(prev => !prev)}
                className={`flex items-center gap-5 px-6 py-4 cursor-pointer transition-colors ${
                  isDark ? "hover:bg-[var(--accent-soft-10)] text-[#e9edef]" : "hover:bg-slate-50 text-slate-800"
                }`}
              >
                <Clock size={20} className={isDark ? "text-[var(--panel-muted)]" : "text-slate-400"} />
                <div className="flex-1">
                  <div className="text-[15px]">Disappearing messages</div>
                  <div className={`text-xs mt-0.5 ${isDark ? "text-[var(--panel-muted)]" : "text-slate-500"}`}>
                    {disappearingLabel()}
                  </div>
                </div>
                <ChevronDown size={16} className={isDark ? "text-[var(--panel-muted)]" : "text-slate-400"} />
              </div>

              {/* Disappearing Messages Options Dropdown */}
              {disappearingOpen && (
                <div className={`absolute right-6 top-full mt-1 z-30 w-52 rounded-xl shadow-xl border p-1.5 ${
                  isDark ? "bg-[var(--panel-bg-2)] border-[var(--panel-border)] text-slate-100" : "bg-white border-slate-200 text-slate-800"
                }`}>
                  {[
                    { val: 0, label: "Off" },
                    { val: 3600, label: "1 hr after seen" },
                    { val: 86400, label: "24 hr" }
                  ].map(option => (
                    <button
                      key={option.val}
                      type="button"
                      onClick={() => handleSetDisappearing(option.val)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                        isDark 
                          ? "hover:bg-[var(--accent-soft-18)]" 
                          : "hover:bg-slate-100"
                      }`}
                    >
                      <span>{option.label}</span>
                      {disappearingDuration === option.val && <Check size={14} className="text-accent" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action List (Danger / Fav / Delete) */}
          <div className={`divide-y ${
            isDark ? "bg-[var(--panel-bg)] divide-white/5 border-b border-white/5" : "bg-[#ffffff] divide-slate-100 border-b border-slate-200"
          }`}>
            {/* Add/Remove Favourites */}
            <div 
              onClick={handleToggleFavourite}
              className={`flex items-center gap-5 px-6 py-4 cursor-pointer transition-colors ${
                isDark ? "hover:bg-[var(--accent-soft-10)] text-[#e9edef]" : "hover:bg-slate-50 text-slate-850"
              }`}
            >
              <Heart 
                size={20} 
                className={isFavourite ? "" : (isDark ? "text-[var(--panel-muted)]" : "text-slate-400")} 
                style={isFavourite ? { fill: "var(--accent)", color: "var(--accent)" } : {}}
              />
              <span className="text-[15px]">
                {isFavourite ? "Remove from favourites" : "Add to favourites"}
              </span>
            </div>

            {/* Clear Chat */}
            <div 
              onClick={handleClearChat}
              className={`flex items-center gap-5 px-6 py-4 cursor-pointer transition-colors ${
                isDark ? "hover:bg-[var(--accent-soft-10)]" : "hover:bg-slate-50"
              } text-[#f15c5c]`}
            >
              <EraserIcon className="w-5 h-5 text-[#f15c5c]" />
              <span className="text-[15px]">Clear chat</span>
            </div>

            {/* Block / Unblock */}
            {!isGroup && (
              <div 
                onClick={blockedByMe ? onUnblockUser : onBlockUser}
                className={`flex items-center gap-5 px-6 py-4 cursor-pointer transition-colors ${
                  isDark ? "hover:bg-[var(--accent-soft-10)]" : "hover:bg-slate-50"
                } text-[#f15c5c]`}
              >
                <Ban size={20} className="text-[#f15c5c]" />
                <span className="text-[15px]">
                  {blockActionBusy ? "Processing..." : (blockedByMe ? "Unblock user" : `Block ${partner?.name || "User"}`)}
                </span>
              </div>
            )}

            {/* Report */}
            {!isGroup && (
              <div 
                onClick={() => setReportOpen(prev => !prev)}
                className={`flex items-center gap-5 px-6 py-4 cursor-pointer transition-colors ${
                  isDark ? "hover:bg-[var(--accent-soft-10)]" : "hover:bg-slate-50"
                } text-[#f15c5c]`}
              >
                <ThumbsDown size={20} className="text-[#f15c5c]" />
                <span className="text-[15px]">
                  {reportOpen ? "Close report form" : `Report ${partner?.name || "User"}`}
                </span>
              </div>
            )}

            {/* Report Form inline expansion */}
            {reportOpen && (
              <div className={`px-6 py-4 space-y-3 ${
                isDark ? "bg-[var(--body-bg-dark)]" : "bg-slate-50"
              }`}>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await onReportUser?.({ reason, details: details.trim() });
                    setReportOpen(false);
                    setReason("spam");
                    setDetails("");
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className={`block text-xs mb-1 font-semibold uppercase ${isDark ? "text-[var(--panel-muted)]" : "text-slate-500"}`}>Reason</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={`w-full rounded border px-3 py-2 text-sm outline-none ${
                        isDark 
                          ? "bg-[var(--panel-bg-2)] border-[var(--panel-border)] text-[#e9edef]" 
                          : "bg-white border-slate-200 text-slate-800"
                      }`}
                    >
                      {REPORT_REASONS.map(r => (
                        <option key={r.id} value={r.id} className={isDark ? "bg-[var(--panel-bg)]" : "bg-white"}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs mb-1 font-semibold uppercase ${isDark ? "text-[var(--panel-muted)]" : "text-slate-500"}`}>Details</label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      rows={3}
                      className={`w-full rounded border px-3 py-2 text-sm outline-none resize-none ${
                        isDark 
                          ? "bg-[var(--panel-bg-2)] border-[var(--panel-border)] text-[#e9edef]" 
                          : "bg-white border-slate-200 text-slate-800"
                      }`}
                      placeholder="Describe..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={reportBusy}
                    className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-medium text-sm transition-colors"
                  >
                    {reportBusy ? "Submitting..." : "Submit Report"}
                  </button>
                </form>
              </div>
            )}

            {/* Delete Chat */}
            <div 
              onClick={() => onDeleteChat?.(chatId)}
              className={`flex items-center gap-5 px-6 py-4 cursor-pointer transition-colors ${
                isDark ? "hover:bg-[var(--accent-soft-10)]" : "hover:bg-slate-50"
              } text-[#f15c5c]`}
            >
              <Trash size={20} className="text-[#f15c5c]" />
              <span className="text-[15px]">Delete chat</span>
            </div>
          </div>

          <CustomConfirmDialog
            isOpen={confirmClearOpen}
            title="Clear Chat"
            message="Are you sure you want to clear all messages in this chat?"
            confirmText="Clear"
            cancelText="Cancel"
            onConfirm={performClearChat}
            onCancel={() => setConfirmClearOpen(false)}
          />
          <PhotoViewer
            src={profilePhotoSrc}
            alt={`${partner?.name || "User"} profile photo`}
            open={profilePhotoOpen && Boolean(profilePhotoSrc)}
            onClose={() => setProfilePhotoOpen(false)}
            square
          />

          {/* Ephemeral Couple Secret Room Modal */}
          <CoupleSecretRoomModal
            open={secretRoomOpen}
            onClose={() => setSecretRoomOpen(false)}
            me={{ id: meId }}
            partner={partner}
            socket={socket}
          />
        </div>
      </aside>
    </div>
  );
}

// Simple custom inline icon for clear chat / eraser
function EraserIcon(props) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  );
}
