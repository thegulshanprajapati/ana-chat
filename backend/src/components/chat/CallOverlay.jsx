import { useMemo, useState } from "react";
import {
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  MonitorUp,
  PhoneCall,
  PhoneOff,
  Plus,
  SendHorizontal,
  Video,
  VideoOff
} from "lucide-react";
import Avatar from "../common/Avatar";

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
  screenSharing = false
}) {
  const idle = !call || call.phase === "idle";
  const isVideo = call?.callType === "video";
  const incoming = call?.phase === "incoming";
  const connecting = call?.phase === "connecting";
  const isVideoChatMode = call?.mode === "video_chat";
  const [chatText, setChatText] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const statusText = call?.phase === "incoming"
    ? "Incoming call"
    : call?.phase === "outgoing"
      ? "Ringing..."
      : call?.phase === "connecting"
        ? "Connecting media..."
        : "Live";

  const compactChatMessages = useMemo(
    () => (chatMessages || [])
      .filter((item) => !item.deleted_for_everyone && item.body)
      .slice(-40),
    [chatMessages]
  );

  async function submitCallChat(event) {
    event.preventDefault();
    const text = chatText.trim();
    if (!text || !onSendChat) return;
    try {
      await onSendChat(text);
      setChatText("");
    } catch {
      // message toast is handled by parent
    }
  }

  if (idle) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/70 p-2 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200/80 px-3 py-3 dark:border-slate-800/80 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <Avatar name={call.peerName} src={call.peerAvatar} size={52} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{call.peerName || "Unknown"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {statusText}
              </p>
              {isVideoChatMode && (
                <p className="mt-1 text-[11px] font-medium text-violet-600 dark:text-violet-300">
                  Video chat mode: microphone disabled
                </p>
              )}
            </div>
            <div className="shrink-0 text-violet-500">{isVideo ? <Video size={18} /> : <PhoneCall size={18} />}</div>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-2 sm:p-4">
          <div className={`grid h-full min-h-[240px] gap-3 ${isVideo ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-[minmax(0,1fr)_300px]"}`}>
            {isVideo ? (
              <div className="relative h-full min-h-[240px] overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700 sm:min-h-[320px]">
                <VideoPanel
                  label="Remote"
                  stream={remoteStream}
                  muted={false}
                  variant="remote"
                  hint={incoming ? "Accept to start video call" : connecting ? "Waiting for remote video..." : ""}
                />
                <div className="absolute bottom-3 right-3 z-10 w-[40%] min-w-[130px] max-w-[220px] sm:w-[28%]">
                  <VideoPanel
                    label="You"
                    stream={localStream}
                    muted
                    variant="local"
                    hint={incoming ? "Preview starts after accept" : connecting ? "Starting your camera..." : ""}
                  />
                </div>
              </div>
            ) : (
              <VoicePanel stream={remoteStream} peerName={call.peerName} connecting={connecting} />
            )}

            <div className={`${mobileChatOpen ? "flex" : "hidden"} min-h-[220px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex`}>
              <CallChatPanel
                messages={compactChatMessages}
                meId={meId}
                value={chatText}
                onChange={setChatText}
                onSubmit={submitCallChat}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 px-3 py-3 dark:border-slate-800/80 sm:px-5">
          <div className="flex items-center gap-2">
            {!incoming && (
              <>
                <ControlButton
                  onClick={onToggleMic}
                  label={micEnabled ? "Mic on" : "Mic off"}
                  active={micEnabled}
                  disabled={isVideoChatMode}
                  icon={micEnabled ? <Mic size={15} /> : <MicOff size={15} />}
                />
                {isVideo && (
                  <ControlButton
                    onClick={onToggleVideo}
                    label={videoEnabled ? "Video on" : "Video off"}
                    active={videoEnabled}
                    icon={videoEnabled ? <Video size={15} /> : <VideoOff size={15} />}
                  />
                )}
                {isVideo && (
                  <ControlButton
                    onClick={onToggleScreenShare}
                    label={screenSharing ? "Stop share" : "Share screen"}
                    active={screenSharing}
                    icon={<MonitorUp size={15} />}
                  />
                )}
                <ControlButton
                  onClick={onAddParticipant}
                  label="Add participant"
                  icon={<Plus size={15} />}
                />
                <ControlButton
                  onClick={() => setMobileChatOpen((prev) => !prev)}
                  label={mobileChatOpen ? "Hide chat" : "Show chat"}
                  icon={<MessageSquareText size={15} />}
                  className="lg:hidden"
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {incoming ? (
              <>
                <button
                  type="button"
                  onClick={onReject}
                  className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                >
                  <PhoneOff size={14} /> Reject
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
                >
                  <PhoneCall size={14} /> Accept
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onEnd}
                className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
              >
                <PhoneOff size={14} /> End
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function hasLiveVideoTrack(stream) {
  if (!stream || typeof stream.getVideoTracks !== "function") return false;
  return stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled !== false);
}

function VideoPanel({ label, stream, muted, variant = "remote", hint = "" }) {
  const hasVideo = hasLiveVideoTrack(stream);
  const isLocal = variant === "local";

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${isLocal ? "border-violet-300/55 shadow-xl shadow-violet-500/20" : "h-full border-slate-700"} bg-slate-950`}>
      {stream && (
        <video
          autoPlay
          playsInline
          muted={muted}
          ref={(node) => {
            if (node) node.srcObject = stream;
          }}
          className={`${isLocal ? "h-[170px] sm:h-[200px]" : "h-full min-h-[240px] sm:min-h-[320px]"} w-full ${hasVideo ? "object-cover opacity-100" : "pointer-events-none opacity-0"} transition-opacity`}
        />
      )}

      {!hasVideo && (
        <div
          className={`absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top,rgb(var(--accent-500-rgb)_/_0.18),transparent_55%),linear-gradient(180deg,rgb(var(--accent-950-rgb)_/_0.20),rgb(0_0_0_/_0.98))] p-4 text-center ${
            isLocal ? "text-slate-300" : "text-slate-200"
          }`}
        >
          <div>
            <VideoOff size={isLocal ? 16 : 22} className="mx-auto mb-2 text-violet-300/90" />
            <p className={`${isLocal ? "text-[11px]" : "text-xs sm:text-sm"} font-medium`}>
              {hint || "Video unavailable"}
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-900/45 to-transparent px-2.5 py-2">
        <p className="text-xs font-medium text-slate-300">{label}</p>
      </div>
    </div>
  );
}

function VoicePanel({ stream, peerName, connecting }) {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-slate-700 bg-[radial-gradient(circle_at_top,rgb(var(--accent-500-rgb)_/_0.18),transparent_52%),linear-gradient(180deg,rgb(var(--accent-950-rgb)_/_0.20),rgb(0_0_0_/_0.98))] p-6 text-center text-sm text-slate-200">
      <div>
        {connecting ? (
          <Loader2 size={30} className="mx-auto mb-3 animate-spin text-violet-300" />
        ) : (
          <Mic size={30} className="mx-auto mb-3 text-violet-300" />
        )}
        <p className="text-sm font-semibold text-slate-100">
          {connecting ? "Connecting voice call..." : `Voice call with ${peerName || "user"}`}
        </p>
      </div>
      <audio
        autoPlay
        playsInline
        ref={(node) => {
          if (node) node.srcObject = stream || null;
        }}
      />
    </div>
  );
}

function ControlButton({ icon, label, onClick, active = false, disabled = false, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-violet-300 bg-violet-500/15 text-violet-700 dark:border-violet-400/45 dark:bg-violet-400/10 dark:text-violet-200"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      title={label}
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CallChatPanel({ messages, meId, value, onChange, onSubmit }) {
  return (
    <>
      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          In-call chat
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {!messages.length && (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Send a message while call is active.
          </p>
        )}
        {messages.map((message) => {
          const mine = String(message.sender_id) === String(meId);
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs ${
                mine
                  ? "bg-violet-500 text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
              >
                {message.body}
              </p>
            </div>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-200 p-2 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-500"
            placeholder="Type message..."
          />
          <button
            type="submit"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500 text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!value.trim()}
            aria-label="Send call chat message"
          >
            <SendHorizontal size={15} />
          </button>
        </div>
      </form>
    </>
  );
}
