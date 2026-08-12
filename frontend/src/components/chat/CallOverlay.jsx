import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { motion } from "framer-motion";
import {
  MessageSquareText,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Plus,
  SendHorizontal,
  Video,
  VideoOff,
  X,
  ChevronDown,
  Signal,
  Maximize2,
  Minimize2,
  PictureInPicture
} from "lucide-react";
import Avatar from "../common/Avatar";

/* ─── helpers ─── */
function hasLiveVideoTrack(stream) {
  if (!stream || typeof stream.getVideoTracks !== "function") return false;
  return stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled !== false);
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ─── video element ─── */
const VideoEl = forwardRef(({ stream, muted, className }, ref) => {
  const localRef = useRef(null);
  const actualRef = ref || localRef;
  useEffect(() => {
    if (actualRef.current) actualRef.current.srcObject = stream || null;
  }, [stream, actualRef]);
  return <video ref={actualRef} autoPlay playsInline muted={muted} className={className} />;
});
VideoEl.displayName = "VideoEl";

/* ─── main export ─── */
export default function CallOverlay({
  call,
  localStream,
  remoteStream,
  meId,
  chatMessages = [],
  onSendChat,
  onAccept,
  onReject,
  onEnd,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  onAddParticipant,
  micEnabled = true,
  videoEnabled = true,
  screenSharing = false,
}) {
  const idle = !call || call.phase === "idle";
  const isVideo = call?.callType === "video";
  const incoming = call?.phase === "incoming";
  const connecting = call?.phase === "connecting";
  const outgoing = call?.phase === "outgoing";
  const live = call?.phase === "active" || call?.phase === "connected";
  const isVideoChatMode = call?.mode === "video_chat";

  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const hideTimer = useRef(null);
  const chatEndRef = useRef(null);

  const remoteVideoRef = useRef(null);
  const mainContainerRef = useRef(null);

  const [isPip, setIsPip] = useState(false);
  const [pipSize, setPipSize] = useState({ width: 260, height: 380 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    resizeStartRef.current = {
      x: clientX,
      y: clientY,
      w: pipSize.width,
      h: pipSize.height
    };
  };

  useEffect(() => {
    const handleResizeMove = (e) => {
      if (!isResizing) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = clientX - resizeStartRef.current.x;
      const dy = clientY - resizeStartRef.current.y;
      
      setPipSize({
        width: Math.max(180, Math.min(600, resizeStartRef.current.w + dx)),
        height: Math.max(240, Math.min(800, resizeStartRef.current.h + dy))
      });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
      window.addEventListener("touchmove", handleResizeMove);
      window.addEventListener("touchend", handleResizeEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("touchmove", handleResizeMove);
      window.removeEventListener("touchend", handleResizeEnd);
    };
  }, [isResizing]);

  // Draggable chat panel state
  const [chatPosition, setChatPosition] = useState(() => {
    const width = typeof window !== "undefined" ? window.innerWidth : 800;
    return { x: Math.max(16, width - 360), y: 100 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });

  const handleDragStart = (e) => {
    setIsDragging(true);
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    dragStartRef.current = { x: clientX, y: clientY };
    posStartRef.current = { ...chatPosition };
  };

  useEffect(() => {
    const handleDragMove = (e) => {
      if (!dragStartRef.current.x) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      
      const newX = posStartRef.current.x + dx;
      const newY = posStartRef.current.y + dy;

      const maxX = window.innerWidth - 320;
      const maxY = window.innerHeight - 450;
      setChatPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      dragStartRef.current = { x: 0, y: 0 };
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove);
      window.addEventListener("touchend", handleDragEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging]);

  /* Timer */
  useEffect(() => {
    if (!live) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  /* Auto-hide controls during active video */
  const revealControls = () => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    if (live && isVideo) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  };
  useEffect(() => { revealControls(); return () => clearTimeout(hideTimer.current); }, [live, isVideo]);

  /* Scroll chat to bottom */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const compactMessages = useMemo(
    () => (chatMessages || []).filter((m) => !m.deleted_for_everyone && m.body).slice(-60),
    [chatMessages]
  );

  async function submitChat(e) {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || !onSendChat) return;
    try { await onSendChat(text); setChatText(""); } catch { /* handled by parent */ }
  }

  if (idle) return null;

  const statusLabel = incoming ? "Incoming call…"
    : outgoing ? "Ringing…"
    : connecting ? "Connecting…"
    : live ? fmtTime(elapsed)
    : "Call";

  const remoteHasVideo = hasLiveVideoTrack(remoteStream);
  const localHasVideo = hasLiveVideoTrack(localStream);

  return (
    <motion.div
      ref={mainContainerRef}
      drag={isPip}
      dragMomentum={false}
      dragElastic={0.05}
      dragConstraints={{
        left: 0,
        right: typeof window !== "undefined" ? window.innerWidth - pipSize.width : 500,
        top: 0,
        bottom: typeof window !== "undefined" ? window.innerHeight - pipSize.height : 500
      }}
      className={isPip 
        ? "fixed z-[90] overflow-hidden rounded-3xl border-2 border-white/20 shadow-2xl bg-[#0d0d0f] flex flex-col touch-none cursor-grab active:cursor-grabbing" 
        : "fixed inset-0 z-[90] flex flex-col bg-[#0d0d0f] overflow-hidden"
      }
      style={{
        width: isPip ? `${pipSize.width}px` : "100vw",
        height: isPip ? `${pipSize.height}px` : "100vh",
        right: isPip ? "20px" : "0px",
        top: isPip ? "80px" : "0px",
        position: "fixed"
      }}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
    >
      {/* ── BACKGROUND for voice / no-video ── */}
      {(!isVideo || !remoteHasVideo) && !incoming && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0d0d0f] to-slate-950" />
      )}

      {/* ── INCOMING CALL SCREEN ── */}
      {incoming && (
        <IncomingScreen
          call={call}
          isVideo={isVideo}
          onAccept={onAccept}
          onReject={onReject}
        />
      )}

      {/* ── ACTIVE CALL ── */}
      {!incoming && (
        <>
          {/* Remote video fullscreen */}
          {isVideo && (
            <div className="absolute inset-0">
              {remoteHasVideo ? (
                <VideoEl
                  ref={remoteVideoRef}
                  stream={remoteStream}
                  muted={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <NoVideoPlaceholder name={call.peerName} avatar={call.peerAvatar} connecting={connecting} />
              )}
            </div>
          )}

          {/* Voice-only panel */}
          {!isVideo && (
            <VoiceFullscreenPanel
              stream={remoteStream}
              peerName={call.peerName}
              peerAvatar={call.peerAvatar}
              connecting={connecting}
              elapsed={elapsed}
              live={live}
            />
          )}

          {/* Local PiP */}
          {isVideo && (
            <motion.div
              drag
              dragConstraints={mainContainerRef}
              dragElastic={0.15}
              dragMomentum={false}
              className="absolute bottom-28 right-4 z-20 w-[120px] sm:w-[160px] overflow-hidden rounded-2xl border-2 border-white/20 shadow-2xl shadow-black/50 sm:bottom-32 sm:right-6 touch-none cursor-grab active:cursor-grabbing"
            >
              {localHasVideo ? (
                <VideoEl stream={localStream} muted className="h-full w-full object-cover aspect-[3/4] pointer-events-none" />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center bg-slate-800 pointer-events-none">
                  <VideoOff size={22} className="text-slate-400" />
                </div>
              )}
              {isVideoChatMode && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[9px] font-semibold text-rose-300 pointer-events-none">
                  Mic off (chat mode)
                </div>
              )}
              {/* You label */}
              <div className="absolute top-1.5 left-2 text-[10px] font-bold text-white/80 drop-shadow pointer-events-none">You</div>
            </motion.div>
          )}

          {/* Top bar (only shown if not in PiP mode) */}
          {!isPip && (
            <div
              className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 pt-safe-top pb-4 pt-4 transition-opacity duration-500 bg-gradient-to-b from-black/60 via-black/20 to-transparent ${
                controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar name={call.peerName} src={call.peerAvatar} size={36} />
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{call.peerName || "Unknown"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                    <p className="text-xs text-white/70">{statusLabel}</p>
                    {live && <Signal size={10} className="text-emerald-400" />}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChatOpen((v) => !v)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    chatOpen ? "bg-white/20 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                  title="In-call chat"
                >
                  <MessageSquareText size={16} />
                </button>
                {isVideo && (
                  <button
                    type="button"
                    onClick={() => setIsPip(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition"
                    title="Picture-in-Picture"
                  >
                    <PictureInPicture size={15} />
                  </button>
                )}
                {isVideo && (
                  <button
                    type="button"
                    onClick={() => setFullscreen((v) => !v)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition"
                  >
                    {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PiP Mode Overlay Controls */}
          {isPip && (
            <>
              {/* Resize Handle */}
              <div
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
                className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize z-50 flex items-center justify-end p-1 select-none pointer-events-auto"
                style={{ cursor: "nwse-resize" }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-white/40">
                  <path d="M10 0 L0 10 M10 4 L4 10 M10 8 L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* PiP Top Bar Controls */}
              <div className="absolute top-2 inset-x-2 z-30 flex items-center justify-between pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setIsPip(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/40 hover:bg-black/60 text-white backdrop-blur transition"
                  title="Maximize"
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={onEnd}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition"
                  title="End Call"
                >
                  <PhoneOff size={14} />
                </button>
              </div>

              {/* PiP Bottom Controls */}
              <div className="absolute bottom-2 inset-x-2 z-30 flex items-center justify-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur transition ${
                    micEnabled ? "bg-black/40 text-white hover:bg-black/60" : "bg-rose-600 text-white"
                  }`}
                >
                  {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                </button>
                <button
                  type="button"
                  onClick={onToggleVideo}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur transition ${
                    videoEnabled ? "bg-black/40 text-white hover:bg-black/60" : "bg-rose-600 text-white"
                  }`}
                >
                  {videoEnabled ? <Video size={14} /> : <VideoOff size={14} />}
                </button>
              </div>
            </>
          )}

          {/* Bottom controls bar */}
          {!isPip && (
            <div
              className={`absolute inset-x-0 bottom-0 z-30 px-4 pb-6 pt-4 transition-opacity duration-500 bg-gradient-to-t from-black/70 via-black/30 to-transparent ${
                controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="mx-auto flex max-w-lg items-center justify-center gap-3">
                {/* Mic */}
                <RoundControl
                  onClick={onToggleMic}
                  label={micEnabled ? "Mute" : "Unmute"}
                  disabled={isVideoChatMode}
                  active={!micEnabled}
                  icon={micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                />

                {/* Video toggle */}
                {isVideo && (
                  <RoundControl
                    onClick={onToggleVideo}
                    label={videoEnabled ? "Stop video" : "Start video"}
                    active={!videoEnabled}
                    icon={videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                  />
                )}

                {/* Screen share */}
                {isVideo && (
                  <RoundControl
                    onClick={onToggleScreenShare}
                    label={screenSharing ? "Stop share" : "Share screen"}
                    active={screenSharing}
                    icon={<MonitorUp size={20} />}
                    accent="blue"
                  />
                )}

                {/* Add participant */}
                <RoundControl
                  onClick={onAddParticipant}
                  label="Add participant"
                  icon={<Plus size={20} />}
                />

                {/* END CALL — big red prominent button */}
                <button
                  type="button"
                  onClick={onEnd}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_8px_30px_rgba(225,29,72,0.6)] transition hover:bg-rose-500 hover:scale-105 active:scale-95"
                  title="End call"
                >
                  <PhoneOff size={22} />
                </button>
              </div>

              {/* Hint for video chat mode */}
              {isVideoChatMode && (
                <p className="mt-3 text-center text-[11px] text-rose-300/80">
                  🎙️ Microphone is disabled in video chat mode
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── IN-CALL CHAT DRAWER ── */}
      {!isPip && chatOpen && !incoming && (
        <div
          style={{
            left: `${chatPosition.x}px`,
            top: `${chatPosition.y}px`,
            position: 'absolute'
          }}
          className="z-40 flex w-[320px] h-[450px] flex-col rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden select-none"
        >
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 cursor-grab active:cursor-grabbing bg-white/5 select-none shrink-0"
          >
            <p className="text-xs font-bold text-white select-none">In-call chat</p>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition"
            >
              <X size={14} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {!compactMessages.length && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <MessageSquareText size={28} className="text-white/20" />
                <p className="text-xs text-white/40">Messages sent here are only visible during this call.</p>
              </div>
            )}
            {compactMessages.map((msg) => {
              const mine = String(msg.sender_id) === String(meId);
              return (
                <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    mine
                      ? "bg-rose-600 text-white rounded-br-sm"
                      : "bg-white/15 text-white/90 rounded-bl-sm"
                  }`}>
                    {msg.body}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={submitChat} className="border-t border-white/10 p-3 shrink-0">
            <div className="flex items-center gap-2">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="h-10 flex-1 rounded-full border border-white/20 bg-white/10 px-4 text-xs text-white placeholder:text-white/40 outline-none focus:border-rose-500/60 transition"
                placeholder="Message..."
              />
              <button
                type="submit"
                disabled={!chatText.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500 disabled:opacity-40"
              >
                <SendHorizontal size={14} />
              </button>
            </div>
          </form>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Incoming call screen ─── */
function IncomingScreen({ call, isVideo, onAccept, onReject }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-between py-20 px-6">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0d0d0f] to-slate-950" />

      {/* Animated ring */}
      <div className="relative z-10 flex flex-col items-center gap-6 mt-8">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-40 w-40 rounded-full border-2 border-rose-500/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute h-32 w-32 rounded-full border-2 border-rose-400/30 animate-ping" style={{ animationDuration: "2.6s", animationDelay: "0.4s" }} />
          <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-rose-500/50 shadow-[0_0_48px_rgba(225,29,72,0.4)]">
            <Avatar name={call.peerName} src={call.peerAvatar} size={96} />
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-2xl font-bold text-white">{call.peerName || "Unknown"}</p>
          <p className="text-sm text-white/60">
            {isVideo ? "📹 Incoming video call" : "📞 Incoming voice call"}
          </p>
        </div>

        {/* Ripple animation dots */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>

      {/* Accept / Reject */}
      <div className="relative z-10 flex items-center justify-center gap-16">
        {/* Reject */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onReject}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_8px_30px_rgba(225,29,72,0.5)] transition hover:bg-rose-500 hover:scale-105 active:scale-95"
          >
            <PhoneOff size={26} />
          </button>
          <span className="text-xs text-white/60">Decline</span>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_30px_rgba(16,185,129,0.5)] transition hover:bg-emerald-400 hover:scale-105 active:scale-95"
          >
            <Phone size={26} />
          </button>
          <span className="text-xs text-white/60">Accept</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Voice-only fullscreen ─── */
function VoiceFullscreenPanel({ stream, peerName, peerAvatar, connecting, elapsed, live }) {
  return (
    <>
      <audio
        autoPlay
        playsInline
        ref={(node) => { if (node) node.srcObject = stream || null; }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
        {/* Pulsing avatar */}
        <div className="relative flex items-center justify-center">
          {live && (
            <>
              <div className="absolute h-48 w-48 rounded-full bg-rose-500/10 animate-ping" style={{ animationDuration: "2.2s" }} />
              <div className="absolute h-36 w-36 rounded-full bg-rose-400/15 animate-ping" style={{ animationDuration: "2.8s", animationDelay: "0.5s" }} />
            </>
          )}
          <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white/20 shadow-2xl">
            <Avatar name={peerName} src={peerAvatar} size={112} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-bold text-white">{peerName || "Unknown"}</p>
          {connecting ? (
            <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="ml-1">Connecting…</span>
            </div>
          ) : live ? (
            <div className="flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm font-semibold text-emerald-400">{fmtTime(elapsed)}</p>
            </div>
          ) : (
            <p className="text-sm text-white/60">Voice call</p>
          )}
        </div>

        {/* Animated sound wave */}
        {live && (
          <div className="flex items-end gap-1 h-8">
            {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.3, 0.7, 1, 0.4].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-rose-500/60 animate-pulse"
                style={{
                  height: `${h * 100}%`,
                  animationDelay: `${i * 80}ms`,
                  animationDuration: `${600 + i * 60}ms`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── No-video placeholder ─── */
function NoVideoPlaceholder({ name, avatar, connecting }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white/10 shadow-xl">
          <Avatar name={name} src={avatar} size={96} />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-white/80">{name || "Connecting..."}</p>
          {connecting && (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          )}
          {!connecting && <p className="mt-1 text-xs text-white/40">Camera is off</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Round control button ─── */
function RoundControl({ icon, label, onClick, active = false, disabled = false, accent = "default" }) {
  const base = "flex h-12 w-12 flex-col items-center justify-center rounded-full transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";
  const colors = active
    ? accent === "blue"
      ? "bg-sky-500/90 text-white shadow-[0_4px_20px_rgba(14,165,233,0.4)]"
      : "bg-white/25 text-white"
    : "bg-white/15 text-white/80 hover:bg-white/25";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${base} ${colors}`}
        title={label}
        aria-label={label}
      >
        {icon}
      </button>
      <span className="text-[10px] text-white/50 leading-none">{label}</span>
    </div>
  );
}
