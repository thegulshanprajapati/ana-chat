import { useEffect, useMemo, useState } from "react";
import { 
  X, Search, Star, Bell, Clock, Heart, 
  Trash2, Flag, UserMinus, UserCheck, Folder, Download, 
  Trash, Ban, ThumbsDown, Pencil, ChevronDown, Check
} from "lucide-react";
import Avatar from "../common/Avatar";
import { formatDayLabel, formatTime } from "../../utils/time";
import { api } from "../../api/client";

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
  theme = "dark"
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Real localStorage states
  const [isFavourite, setIsFavourite] = useState(false);
  const [muted, setMuted] = useState(false);
  const [disappearingDuration, setDisappearingDuration] = useState(0); // 0 = off, 3600 = 1hr, 86400 = 24hr
  const [disappearingOpen, setDisappearingOpen] = useState(false);

  const isDark = theme === "dark";

  const username = useMemo(() => deriveUsername(partner), [partner]);
  const statusLine = useMemo(() => lastActiveText(partner, nowMs, isGroup, memberCount), [isGroup, memberCount, nowMs, partner]);
  const online = useMemo(() => statusLine === "Online now", [statusLine]);

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
  const handleClearChat = async () => {
    if (!chatId) return;
    const confirm = window.confirm("Are you sure you want to clear all messages in this chat?");
    if (confirm) {
      try {
        await api.post(`/chats/${chatId}/clear`);
        window.dispatchEvent(new Event("ana_chats_updated"));
        window.dispatchEvent(new CustomEvent("ana_active_chat_cleared", { detail: { chatId } }));
      } catch (err) {
        alert(err.response?.data?.message || "Failed to clear chat.");
      }
    }
  };

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(partner?.name || "");

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
        } catch (err) {
          alert(err.response?.data?.message || "Failed to rename contact.");
        }
      }
      setIsEditingName(false);
    } else {
      setIsEditingName(true);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Filter messages that have media
  const chatMedia = useMemo(() => {
    if (!messages) return [];
    return messages.filter(m => m.image_url && !m.deleted_for_everyone);
  }, [messages]);

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
              <Avatar name={partner?.name} src={partner?.avatar_url} size={150} />
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
            <p className={`mt-1.5 text-[14px] text-center ${
              isDark ? "text-[var(--panel-muted)]" : "text-slate-500"
            }`}>
              {phoneDisplay}
            </p>
            {/* Username */}
            <p className="mt-1 text-xs text-accent">
              {username}
            </p>

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
              <span className="text-xs hover:underline cursor-pointer">
                {chatMedia.length || 5}
              </span>
            </div>
            
            {/* Thumbnails grid */}
            <div className="flex items-center gap-3">
              {chatMedia.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {chatMedia.slice(0, 3).map((item, idx) => (
                    <img 
                      key={idx}
                      src={item.image_url} 
                      alt="chat-media" 
                      className={`w-[82px] h-[82px] object-cover rounded-lg ${
                        isDark ? "bg-[var(--panel-bg-2)]" : "bg-slate-100"
                      }`}
                    />
                  ))}
                </div>
              ) : (
                /* Mockups for Visual Aesthetic if no media */
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <img 
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" 
                      alt="media-mock" 
                      className={`w-[82px] h-[82px] object-cover rounded-lg filter brightness-90 ${
                        isDark ? "bg-[var(--panel-bg-2)]" : "bg-slate-100"
                      }`}
                    />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-[9px] px-1 rounded text-white flex items-center gap-0.5">
                      🎥 0:05
                    </span>
                  </div>
                  <img 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" 
                    alt="media-mock-2" 
                    className={`w-[82px] h-[82px] object-cover rounded-lg ${
                      isDark ? "bg-[var(--panel-bg-2)]" : "bg-slate-100"
                    }`}
                  />
                  <div className={`flex h-[82px] w-[82px] items-center justify-center rounded-lg cursor-pointer ${
                    isDark ? "bg-[var(--panel-bg-2)] text-[var(--panel-muted)] hover:text-slate-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}>
                    <Download size={18} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Core Settings Menu */}
          <div className={`divide-y ${
            isDark ? "bg-[var(--panel-bg)] divide-[var(--panel-border)]/30" : "bg-[#ffffff] divide-slate-100 border-b border-slate-200"
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
            isDark ? "bg-[var(--panel-bg)] divide-[var(--panel-border)]/30" : "bg-[#ffffff] divide-slate-100 border-b border-slate-200"
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
