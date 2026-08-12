/**
 * CoupleSecretRoomModal
 * ─────────────────────
 * High-security ephemeral chat room for linked couples.
 *
 * ⚠️  Zero Database Persistence Mandate:
 *   - Messages are stored exclusively in React component state.
 *   - Transmitted directly over Socket.io in transient memory.
 *   - NEVER written to MongoDB or IndexedDB.
 *   - Closing or leaving the room instantly wipes all messages.
 *   - Includes floating emoji reaction layer overlay (❤️, 😡, 😂, 🔥, ✨).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Lock, Send, Smile, ShieldAlert, Sparkles, Trash2, Heart
} from "lucide-react";
import Avatar from "../common/Avatar";
import ReactionTray from "./ReactionTray";
import FloatingReactionLayer from "./FloatingReactionLayer";

export default function CoupleSecretRoomModal({
  open,
  onClose,
  me,
  partner,
  socket,
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean memory wipe on close or unmount
  const wipeMemory = useCallback(() => {
    setMessages([]);
    setFloatingReactions([]);
    setInputText("");
    if (socket && partner?.id) {
      socket.emit("couple_secret:leave", { targetUserId: partner.id });
    }
  }, [socket, partner?.id]);

  const handleClose = () => {
    wipeMemory();
    onClose?.();
  };

  // Socket event handlers
  useEffect(() => {
    if (!open || !socket || !partner?.id) return;

    // Notify partner that we entered secret room
    socket.emit("couple_secret:join", { targetUserId: partner.id });

    const handleSecretMsg = (data) => {
      if (Number(data.senderId) !== Number(partner.id)) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `sec-${Date.now()}-${Math.random()}`,
          senderId: data.senderId,
          text: data.text,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      ]);
    };

    const handleSecretReaction = (data) => {
      if (Number(data.senderId) !== Number(partner.id)) return;
      const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setFloatingReactions((prev) => [
        ...prev,
        { id, emoji: data.type, mine: false, isCouple: true },
      ]);
    };

    const handlePartnerLeft = () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          isSystem: true,
          text: `${partner.name || "Partner"} left the Secret Room.`,
        },
      ]);
    };

    socket.on("couple_secret:message", handleSecretMsg);
    socket.on("couple_secret:reaction", handleSecretReaction);
    socket.on("couple_secret:leave", handlePartnerLeft);

    return () => {
      socket.off("couple_secret:message", handleSecretMsg);
      socket.off("couple_secret:reaction", handleSecretReaction);
      socket.off("couple_secret:leave", handlePartnerLeft);
    };
  }, [open, socket, partner?.id, partner?.name]);

  // Send message — ephemeral only
  const sendMessage = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !partner?.id) return;

    const msgObj = {
      id: `sec-${Date.now()}-${Math.random()}`,
      senderId: me.id,
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, msgObj]);
    setInputText("");

    if (socket) {
      socket.emit("couple_secret:message", {
        targetUserId: partner.id,
        text,
        timestamp: msgObj.timestamp,
      });
    }
  };

  // Send floating reaction — ephemeral only
  const sendReaction = (emoji) => {
    const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFloatingReactions((prev) => [
      ...prev,
      { id, emoji, mine: true, isCouple: true },
    ]);

    if (socket && partner?.id) {
      socket.emit("couple_secret:reaction", {
        targetUserId: partner.id,
        type: emoji,
      });
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative flex flex-col w-full max-w-lg h-[92vh] max-h-[700px] rounded-3xl border border-rose-500/30 bg-slate-950/95 shadow-[0_0_60px_rgba(244,63,94,0.25)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-rose-500/20 bg-rose-950/20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar name={partner?.name} src={partner?.avatar_url} size={42} />
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-rose-500 flex items-center justify-center text-[10px]">
                  <Heart size={10} className="fill-white text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white">{partner?.name || "Partner"}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Couple Room
                  </span>
                </div>
                <p className="text-[11px] text-rose-300/70 flex items-center gap-1">
                  <Lock size={10} /> Ephemeral · 0% Database Storage
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={wipeMemory}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-white/10 transition"
                title="Wipe current chat memory"
              >
                <Trash2 size={13} /> Clear
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Privacy Banner */}
          <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/15 flex items-center justify-center gap-2 text-center">
            <ShieldAlert size={13} className="text-rose-400 shrink-0" />
            <p className="text-[11px] text-rose-200/90">
              Messages in this room live in RAM only. Closing this window wipes everything permanently.
            </p>
          </div>

          {/* Floating Emoji Reactions Overlay */}
          <FloatingReactionLayer
            reactions={floatingReactions}
            onReactionClick={() => {}}
            isCouple={true}
          />

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                <div className="h-16 w-16 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
                  <Sparkles size={28} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Private Ephemeral Room Active</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Talk freely with {partner?.name}. No messages are saved to database or local storage.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="text-center py-2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                const isMine = Number(msg.senderId) === Number(me?.id);
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-br-xs shadow-[0_4px_15px_rgba(244,63,94,0.3)]"
                          : "bg-slate-900 border border-white/10 text-slate-100 rounded-bl-xs"
                      }`}
                    >
                      <p>{msg.text}</p>
                      <p className={`text-[9px] mt-1 text-right ${isMine ? "text-rose-200/70" : "text-slate-400"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reaction Tray */}
          <ReactionTray
            open={reactionTrayOpen}
            onClose={() => setReactionTrayOpen(false)}
            onReact={sendReaction}
          />

          {/* Input Bar */}
          <form onSubmit={sendMessage} className="p-3 border-t border-rose-500/20 bg-slate-950/90 relative z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReactionTrayOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 transition active:scale-95 shrink-0"
              title="Send Floating Emoji"
            >
              <Smile size={18} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type ephemeral secret message..."
              className="flex-1 h-10 px-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 outline-none focus:border-rose-500/50 transition"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-600 text-white disabled:opacity-40 hover:bg-rose-500 transition active:scale-95 shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
            >
              <Send size={16} />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
