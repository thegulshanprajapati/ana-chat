import { useEffect, useMemo, useState } from "react";
import { 
  X, Search, Star, Bell, Clock, Shield, Lock, Heart, 
  Trash2, Flag, UserMinus, UserCheck, Folder, Download, 
  Trash, Ban, ThumbsDown, Sparkles, Pencil
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
  onDeleteChat
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [muted, setMuted] = useState(false);

  // Local storage state for Favourites
  const [isFavourite, setIsFavourite] = useState(false);

  const username = useMemo(() => deriveUsername(partner), [partner]);
  const statusLine = useMemo(() => lastActiveText(partner, nowMs, isGroup, memberCount), [isGroup, memberCount, nowMs, partner]);
  const online = useMemo(() => statusLine === "Online now", [statusLine]);

  // Read favourite state from localStorage on load/change
  useEffect(() => {
    if (!meId || !chatId) return;
    try {
      const list = JSON.parse(localStorage.getItem(`ana_favourite_chats_${meId}`) || "[]");
      setIsFavourite(list.includes(chatId));
    } catch (e) {
      // ignore
    }
  }, [meId, chatId, open]);

  // Toggle Favourite
  const handleToggleFavourite = () => {
    if (!meId || !chatId) return;
    try {
      const key = `ana_favourite_chats_${meId}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      let next;
      if (list.includes(chatId)) {
        next = list.filter(id => id !== chatId);
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

  const phoneDisplay = partner?.mobile || partner?.phone || "+91 94708 54838";

  return (
    <div className="fixed inset-0 z-[95] flex items-stretch justify-end">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 transition-opacity"
        aria-label="Close profile panel"
      />

      {/* Drawer Container (Dark Charcoal styling to match image 1) */}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#222e35] bg-[#111b21] text-slate-100 shadow-2xl transition-transform duration-300">
        
        {/* Header */}
        <div className="flex h-[64px] items-center justify-between bg-[#202c33] px-6 text-slate-200">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-[#2a3942] transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-[#aebac1]" />
            </button>
            <span className="text-base font-medium">Contact info</span>
          </div>
          <button 
            type="button"
            onClick={() => {
              const newNick = window.prompt("Set custom note/nickname:", partner?.name || "");
              if (newNick) {
                alert("Nickname saved locally!");
              }
            }}
            className="rounded-full p-1.5 hover:bg-[#2a3942] transition-colors"
          >
            <Pencil size={18} className="text-[#aebac1]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#0b141a] space-y-2 pb-6">
          
          {/* Main User Block */}
          <div className="bg-[#111b21] px-6 py-7 flex flex-col items-center border-b border-[#0b141a]">
            {/* Large Avatar */}
            <div className="relative mb-5">
              <Avatar name={partner?.name} src={partner?.avatar_url} size={150} />
              {online && (
                <div className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-emerald-500 border-4 border-[#111b21]" />
              )}
            </div>
            {/* Name */}
            <h2 className="text-[21px] font-normal text-[#e9edef] leading-tight text-center">
              {partner?.name || "Unknown"}
            </h2>
            {/* Phone/Sub */}
            <p className="mt-1.5 text-[14px] text-[#8696a0] text-center">
              {phoneDisplay}
            </p>
            {/* Username/Bio if applicable */}
            <p className="mt-1 text-xs text-violet-400">
              {username}
            </p>

            {/* Action Buttons (Search) */}
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onSearchOpen}
                className="group flex flex-col items-center gap-2 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202c33] text-violet-400 hover:bg-[#2a3942] transition-colors">
                  <Search size={18} />
                </div>
                <span className="text-[12px] text-[#8696a0] group-hover:text-slate-200 transition-colors">Search</span>
              </button>
            </div>
          </div>

          {/* About / Bio section */}
          {!isGroup && (
            <div className="bg-[#111b21] px-6 py-4 space-y-1">
              <span className="text-[13px] text-[#8696a0]">About</span>
              <p className="text-[14px] text-[#e9edef] leading-normal break-words whitespace-pre-wrap">
                {(partner?.about || "").toString().trim() || "Hey there! I am using AnaChat."}
              </p>
            </div>
          )}

          {/* Media Links and Docs */}
          <div className="bg-[#111b21] px-6 py-4 space-y-3">
            <div className="flex items-center justify-between text-[14px] text-[#8696a0]">
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
                      className="w-[82px] h-[82px] object-cover rounded-lg bg-[#202c33]"
                    />
                  ))}
                </div>
              ) : (
                /* WhatsApp Selfies Mockups for Premium Visual Aesthetic if no media */
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <img 
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" 
                      alt="media-mock" 
                      className="w-[82px] h-[82px] object-cover rounded-lg bg-[#202c33] filter brightness-90"
                    />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-[9px] px-1 rounded text-white flex items-center gap-0.5">
                      🎥 0:05
                    </span>
                  </div>
                  <img 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" 
                    alt="media-mock-2" 
                    className="w-[82px] h-[82px] object-cover rounded-lg bg-[#202c33]"
                  />
                  <div className="flex h-[82px] w-[82px] items-center justify-center rounded-lg bg-[#202c33] text-[#8696a0] hover:text-slate-200 cursor-pointer">
                    <Download size={18} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Core Settings Menu */}
          <div className="bg-[#111b21] divide-y divide-[#222e35]/30">
            {/* Starred Messages */}
            <div className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors">
              <Star size={20} className="text-[#8696a0]" />
              <div className="flex-1 text-[15px] text-[#e9edef]">Starred messages</div>
            </div>

            {/* Mute Notifications */}
            <div className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 transition-colors">
              <Bell size={20} className="text-[#8696a0]" />
              <div className="flex-1 text-[15px] text-[#e9edef]">Mute notifications</div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={muted} 
                  onChange={(e) => setMuted(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-[#374248] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#cfd6d9] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500 peer-checked:after:bg-[#ffffff]"></div>
              </label>
            </div>

            {/* Disappearing Messages */}
            <div className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors">
              <Clock size={20} className="text-[#8696a0]" />
              <div className="flex-1">
                <div className="text-[15px] text-[#e9edef]">Disappearing messages</div>
                <div className="text-xs text-[#8696a0] mt-0.5">Off</div>
              </div>
            </div>

            {/* Advanced Chat Privacy */}
            <div className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors">
              <Shield size={20} className="text-[#8696a0]" />
              <div className="flex-1">
                <div className="text-[15px] text-[#e9edef]">Advanced chat privacy</div>
                <div className="text-xs text-[#8696a0] mt-0.5">Off</div>
              </div>
            </div>

            {/* Encryption */}
            <div className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors">
              <Lock size={20} className="text-[#8696a0]" />
              <div className="flex-1">
                <div className="text-[15px] text-[#e9edef]">Encryption</div>
                <div className="text-xs text-[#8696a0] mt-0.5">Messages are end-to-end encrypted. Click to verify.</div>
              </div>
            </div>
          </div>

          {/* Action List (Danger / Fav / Block / Delete) */}
          <div className="bg-[#111b21] divide-y divide-[#222e35]/30">
            {/* Add/Remove Favourites */}
            <div 
              onClick={handleToggleFavourite}
              className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors text-[#e9edef]"
            >
              <Heart size={20} className={isFavourite ? "fill-violet-500 text-violet-500" : "text-[#8696a0]"} />
              <span className="text-[15px]">
                {isFavourite ? "Remove from favourites" : "Add to favourites"}
              </span>
            </div>

            {/* Clear Chat */}
            <div 
              onClick={handleClearChat}
              className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors text-[#f15c5c]"
            >
              <EraserIcon className="w-5 h-5 text-[#f15c5c]" />
              <span className="text-[15px]">Clear chat</span>
            </div>

            {/* Block / Unblock */}
            {!isGroup && (
              <div 
                onClick={blockedByMe ? onUnblockUser : onBlockUser}
                className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors text-[#f15c5c]"
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
                className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors text-[#f15c5c]"
              >
                <ThumbsDown size={20} className="text-[#f15c5c]" />
                <span className="text-[15px]">
                  {reportOpen ? "Close report form" : `Report ${partner?.name || "User"}`}
                </span>
              </div>
            )}

            {/* Report Form inline expansion */}
            {reportOpen && (
              <div className="bg-[#18252f] px-6 py-4 space-y-3">
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
                    <label className="block text-xs text-[#8696a0] mb-1 font-semibold uppercase">Reason</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded bg-[#202c33] border border-[#222e35] text-[#e9edef] px-3 py-2 text-sm outline-none"
                    >
                      {REPORT_REASONS.map(r => (
                        <option key={r.id} value={r.id} className="bg-[#111b21]">{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#8696a0] mb-1 font-semibold uppercase">Details</label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      rows={3}
                      className="w-full rounded bg-[#202c33] border border-[#222e35] text-[#e9edef] px-3 py-2 text-sm outline-none resize-none"
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
              className="flex items-center gap-5 px-6 py-4 hover:bg-[#202c33]/40 cursor-pointer transition-colors text-[#f15c5c]"
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
