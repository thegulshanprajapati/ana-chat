import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Code,
  ChevronLeft,
  Camera,
  CornerUpLeft,
  Download,
  Film,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Italic,
  Link2,
  ExternalLink,
  Palette,
  Paperclip,
  Plus,
  SendHorizonal,
  Smile,
  Strikethrough,
  Type,
  Underline,
  Video,
  X
} from "lucide-react";
import { createPortal } from "react-dom";
import EmojiPicker from "emoji-picker-react";
import twemoji from "twemoji";
import { useTheme } from "../../context/ThemeContext";

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

function escapeHtml(value) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emojiHtml(value) {
  return twemoji.parse(escapeHtml(value || ""), {
    folder: "svg",
    ext: ".svg",
    className: "twemoji-icon twemoji-icon--composer"
  });
}

function formatBytes(bytes) {
  const normalized = Number(bytes);
  if (!Number.isFinite(normalized) || normalized <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = normalized;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function replyPreviewText(replyTo) {
  if (!replyTo) return "";
  if (replyTo.deleted_for_everyone) return "This message was deleted";
  if (replyTo.body) return replyTo.body;
  if (replyTo.image_url) return "[media]";
  return "Original message";
}

export default function Composer({
  onTyping,
  onSend,
  disabled,
  disabledReason = "",
  notify,
  enterToSend = true,
  replyTo = null,
  onCancelReply
}) {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreviewOpen, setAttachmentPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [toolStep, setToolStep] = useState("root");
  const [dragActive, setDragActive] = useState(false);
  const imageRef = useRef(null);
  const photoCaptureRef = useRef(null);
  const videoRef = useRef(null);
  const videoCaptureRef = useRef(null);
  const fileRef = useRef(null);
  const toolsRef = useRef(null);
  const inputRef = useRef(null);
  const overlayRef = useRef(null);
  const colorRef = useRef(null);
  const submitLockRef = useRef(false);
  const previewCloseRef = useRef(null);
  const previewPanelRef = useRef(null);
  const replyPreview = useMemo(() => replyPreviewText(replyTo), [replyTo]);
  const replyName = (replyTo?.sender_name || replyTo?.reply_to_sender_name || "Message").toString();

  const preview = useMemo(() => {
    if (!attachment) return null;
    const type = (attachment.type || "").toString();
    const lowerName = (attachment.name || "").toString().toLowerCase();
    const image = type.startsWith("image/");
    const video = type.startsWith("video/");
    const pdf = type === "application/pdf" || lowerName.endsWith(".pdf");
    const url = URL.createObjectURL(attachment);
    return {
      name: attachment.name,
      sizeLabel: formatBytes(attachment.size),
      image,
      video,
      pdf,
      type,
      url
    };
  }, [attachment]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  useEffect(() => {
    if (!attachmentPreviewOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setAttachmentPreviewOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const panel = previewPanelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll(
          'button:not([disabled]), a[href]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => node.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleMouseDown(event) {
      if (previewPanelRef.current?.contains(event.target)) return;
      setAttachmentPreviewOpen(false);
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    requestAnimationFrame(() => previewCloseRef.current?.focus());

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [attachmentPreviewOpen]);

  useEffect(() => {
    if (!showTools && !showFormat) return undefined;
    function closeTools(event) {
      if (!toolsRef.current?.contains(event.target)) {
        setShowTools(false);
        setShowFormat(false);
      }
    }
    window.addEventListener("mousedown", closeTools);
    return () => window.removeEventListener("mousedown", closeTools);
  }, [showFormat, showTools]);

  useEffect(() => {
    if (!showTools) setToolStep("root");
  }, [showTools]);

  useEffect(() => {
    if (!disabled) return;
    setShowEmoji(false);
    setShowTools(false);
    setShowFormat(false);
    setAttachmentPreviewOpen(false);
  }, [disabled]);

  function withSelection(fn) {
    const input = inputRef.current;
    if (!input) return;
    const start = Number.isFinite(input.selectionStart) ? input.selectionStart : text.length;
    const end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : text.length;
    fn({ input, start, end, selected: text.slice(start, end) });
  }

  function replaceSelection(nextValue, nextStart, nextEnd) {
    setText(nextValue);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (Number.isFinite(nextStart) && Number.isFinite(nextEnd)) {
        input.setSelectionRange(nextStart, nextEnd);
      }
    });
  }

  function wrapSelection(prefix, suffix, placeholder = "text") {
    withSelection(({ start, end, selected }) => {
      const hasSelection = Boolean(selected);
      const inner = hasSelection ? selected : placeholder;
      const nextValue = `${text.slice(0, start)}${prefix}${inner}${suffix}${text.slice(end)}`;
      const selStart = start + prefix.length;
      const selEnd = selStart + inner.length;
      replaceSelection(nextValue, selStart, selEnd);
    });
  }

  function insertCustomLink() {
    withSelection(({ start, end, selected }) => {
      const labelSeed = (selected || "").trim();
      const label = labelSeed || (window.prompt("Link text") || "").trim();
      if (!label) return;
      const url = (window.prompt("Link URL") || "").trim();
      if (!url) return;
      const snippet = `${label}[${url}]`;
      const nextValue = `${text.slice(0, start)}${snippet}${text.slice(end)}`;
      replaceSelection(nextValue, start + label.length + 1, start + label.length + 1 + url.length);
      setShowFormat(false);
    });
  }

  function clearAttachment() {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setAttachment(null);
    setAttachmentPreviewOpen(false);
    if (imageRef.current) imageRef.current.value = "";
    if (photoCaptureRef.current) photoCaptureRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";
    if (videoCaptureRef.current) videoCaptureRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }

  function validateAndSet(file) {
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      notify?.({ type: "error", title: "Upload error", message: "File should be less than 50MB." });
      return;
    }

    clearAttachment();
    setAttachment(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    const file = event.dataTransfer?.files?.[0] || null;
    if (file) validateAndSet(file);
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (disabled) return;
    setDragActive(true);
  }

  function handleDragLeave(event) {
    if (event.currentTarget?.contains?.(event.relatedTarget)) return;
    setDragActive(false);
  }

  function insertLink() {
    const input = window.prompt("Paste link");
    if (input == null) return;
    let link = input.trim();
    if (!link) return;

    if (!/^https?:\/\//i.test(link)) {
      link = `https://${link}`;
    }

    setText((prev) => {
      const spacer = prev && !prev.endsWith(" ") ? " " : "";
      return `${prev}${spacer}${link} `;
    });
    setShowTools(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (disabled) return;
    if (!text.trim() && !attachment) return;
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSending(true);
    try {
      await onSend?.({
        body: text.trim(),
        media: attachment,
        replyToMessageId: replyTo?.id || null
      });
      setText("");
      clearAttachment();
      setShowEmoji(false);
      setShowTools(false);
      onCancelReply?.();
    } catch (err) {
      notify?.({
        type: "error",
        title: "Message failed",
        message: err?.response?.data?.message || err?.message || "Unable to send message."
      });
    } finally {
      submitLockRef.current = false;
      setSending(false);
    }
  }

  function openPicker(ref) {
    ref.current?.click();
    setShowTools(false);
    setToolStep("root");
  }

  function downloadAttachment() {
    if (!preview?.url) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.name || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openAttachmentInNewTab() {
    if (!preview?.url) return;
    window.open(preview.url, "_blank", "noopener,noreferrer");
  }

  function replaceAttachment(kind = "file") {
    if (disabled) return;
    if (kind === "photo") {
      setShowTools(true);
      setToolStep("photo");
      return;
    }
    if (kind === "video") {
      setShowTools(true);
      setToolStep("video");
      return;
    }
    openPicker(fileRef);
  }

  function renderToolRoot() {
    return (
      <div className="grid grid-cols-2 gap-2">
        <ToolOption icon={<ImageIcon size={14} />} label="Photo" onClick={() => setToolStep("photo")} />
        <ToolOption icon={<Video size={14} />} label="Video" onClick={() => setToolStep("video")} />
        <ToolOption icon={<Paperclip size={14} />} label="File" onClick={() => openPicker(fileRef)} />
        <ToolOption icon={<Link2 size={14} />} label="Link" onClick={insertLink} />
      </div>
    );
  }

  function renderPhotoOptions() {
    return (
      <>
        <button
          type="button"
          onClick={() => setToolStep("root")}
          className="mb-2 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft size={14} />
          Back
        </button>
        <div className="grid grid-cols-2 gap-2">
          <ToolOption icon={<Camera size={14} />} label="Click photo" onClick={() => openPicker(photoCaptureRef)} />
          <ToolOption icon={<FolderOpen size={14} />} label="Choose photo" onClick={() => openPicker(imageRef)} />
        </div>
      </>
    );
  }

  function renderVideoOptions() {
    return (
      <>
        <button
          type="button"
          onClick={() => setToolStep("root")}
          className="mb-2 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft size={14} />
          Back
        </button>
        <div className="grid grid-cols-2 gap-2">
          <ToolOption icon={<Film size={14} />} label="Record video" onClick={() => openPicker(videoCaptureRef)} />
          <ToolOption icon={<FolderOpen size={14} />} label="Choose video" onClick={() => openPicker(videoRef)} />
        </div>
      </>
    );
  }

  return (
    <form
      onSubmit={submit}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onContextMenu={(event) => event.preventDefault()}
      className={`relative shrink-0 px-3 pt-2.5 pb-[calc(0.85rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-3 ${dragActive ? "ring-2 ring-accent" : ""}`}
      ref={toolsRef}
    >
      {dragActive && !disabled && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-accent-soft text-xs font-semibold text-accent">
          Drop to attach
        </div>
      )}

      {replyTo && (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-accent bg-accent-soft px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1 font-semibold text-accent">
              <CornerUpLeft size={12} />
              Replying to {replyName}
            </p>
            <p className="mt-0.5 max-h-9 overflow-hidden break-words text-slate-600 dark:text-slate-300">{replyPreview}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-md p-1 text-slate-500 transition hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Cancel reply"
            title="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {preview && (
        <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setAttachmentPreviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-full pr-0.5 transition hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-slate-800/70"
            aria-label="Preview attachment"
            disabled={disabled}
          >
            {preview.image && <img src={preview.url} alt={preview.name} className="h-6 w-6 rounded-md object-cover" />}
            {preview.video && !preview.image && <Video size={14} className="text-accent" />}
            {preview.pdf && !preview.image && !preview.video && <FileText size={14} className="text-rose-500 dark:text-rose-300" />}
            {!preview.image && !preview.video && !preview.pdf && <Paperclip size={14} className="text-slate-500 dark:text-slate-300" />}
            <span className="max-w-[180px] truncate">{preview.name}</span>
            {preview.sizeLabel && <span className="hidden text-[11px] opacity-70 sm:inline">{preview.sizeLabel}</span>}
          </button>
          <button
            type="button"
            onClick={clearAttachment}
            className="rounded-full p-0.5 hover:bg-white/80 dark:hover:bg-slate-800"
            aria-label="Remove attachment"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {showTools && (
        <div className="glass-bar mb-2 rounded-3xl p-2 shadow-2xl">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Share options
          </p>
          {toolStep === "root" && renderToolRoot()}
          {toolStep === "photo" && renderPhotoOptions()}
          {toolStep === "video" && renderVideoOptions()}
        </div>
      )}

      {showFormat && (
        <div className="glass-bar mb-2 rounded-3xl p-2 shadow-2xl">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Text styling
          </p>
          <div className="flex flex-wrap gap-1">
            <FormatButton label="Bold" onClick={() => wrapSelection("**", "**", "bold")}>
              <Bold size={16} />
            </FormatButton>
            <FormatButton label="Italic" onClick={() => wrapSelection("*", "*", "italic")}>
              <Italic size={16} />
            </FormatButton>
            <FormatButton label="Underline" onClick={() => wrapSelection("__", "__", "underline")}>
              <Underline size={16} />
            </FormatButton>
            <FormatButton label="Strike" onClick={() => wrapSelection("~~", "~~", "strike")}>
              <Strikethrough size={16} />
            </FormatButton>
            <FormatButton label="Code" onClick={() => wrapSelection("`", "`", "code")}>
              <Code size={16} />
            </FormatButton>
            <FormatButton label="Glow" onClick={() => wrapSelection("[glow]", "[/glow]", "glow")}>
              <Type size={16} />
            </FormatButton>
            <FormatButton label="Link" onClick={insertCustomLink}>
              <Link2 size={16} />
            </FormatButton>
            <FormatButton
              label="Color"
              onClick={() => {
                colorRef.current?.click();
              }}
            >
              <Palette size={16} />
            </FormatButton>
          </div>
          <p className="mt-2 px-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            Link format: <span className="font-semibold">text[url]</span> • Color: <span className="font-semibold">[color:#ff00ff]text[/color]</span>
          </p>
        </div>
      )}

      <div className="glass-bar flex items-end gap-2 rounded-[26px] px-2.5 py-2 shadow-[0_24px_80px_rgb(0_0_0_/_0.32)] transition-[box-shadow,border-color] duration-200 focus-within:border-white/15 focus-within:shadow-[0_26px_92px_rgb(var(--accent-500-rgb)_/_0.16)]">
        <div className="flex shrink-0 items-center">
          <ToolButton
            label="Media and links"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setShowTools((v) => !v);
              setShowEmoji(false);
              setShowFormat(false);
            }}
            active={showTools}
          >
            <Plus size={17} />
          </ToolButton>
          <ToolButton
            label="Text styling"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setShowFormat((v) => !v);
              setShowTools(false);
              setShowEmoji(false);
            }}
            active={showFormat}
          >
            <Type size={17} />
          </ToolButton>
        </div>

        <div className="relative flex-1">
          <div
            ref={overlayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 max-h-28 min-h-11 overflow-auto px-2.5 py-2 text-[15px] leading-5 text-slate-900 outline-none whitespace-pre-wrap break-words dark:text-slate-50"
            dangerouslySetInnerHTML={{ __html: emojiHtml(text) }}
          />
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping?.();
            }}
            onScroll={(event) => {
              if (overlayRef.current) overlayRef.current.scrollTop = event.currentTarget.scrollTop;
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPaste={(event) => {
              if (disabled) return;
              const items = event.clipboardData?.items ? Array.from(event.clipboardData.items) : [];
              const fileItem = items.find((item) => item.kind === "file");
              if (!fileItem) return;
              const file = fileItem.getAsFile();
              if (!file) return;
              event.preventDefault();
              validateAndSet(file);
            }}
            onKeyDown={(event) => {
              if (!enterToSend) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={disabled}
            placeholder={disabled
              ? (disabledReason || "Messaging disabled")
              : (enterToSend ? "Type a message" : "Type a message (Enter for new line)")}
            rows={1}
            className="relative z-10 max-h-28 min-h-11 w-full resize-none bg-transparent px-2.5 py-2 text-[15px] leading-5 text-transparent caret-slate-900 outline-none placeholder:text-slate-500 dark:caret-slate-50 dark:placeholder:text-white/45"
            aria-label="Message input"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ToolButton
            label="Emoji"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setShowEmoji((v) => !v);
              setShowTools(false);
              setShowFormat(false);
            }}
            active={showEmoji}
          >
            <Smile size={17} />
          </ToolButton>
          <ToolButton
            label="Attach file"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              openPicker(fileRef);
            }}
          >
            <Paperclip size={17} />
          </ToolButton>
          <button
            type="submit"
            disabled={disabled || sending}
            className="btn-send inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition duration-200 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Send message"
          >
            <SendHorizonal size={17} className={sending ? "animate-pulse" : ""} />
          </button>
        </div>
      </div>

      {showEmoji && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <EmojiPicker
            width="100%"
            lazyLoadEmojis
            theme={theme === "dark" ? "dark" : "light"}
            onEmojiClick={(emoji) => setText((prev) => prev + emoji.emoji)}
          />
        </div>
      )}

      <input
        ref={colorRef}
        type="color"
        className="hidden"
        onChange={(event) => {
          const hex = (event.target.value || "").toString().trim();
          if (!hex) return;
          wrapSelection(`[color:${hex}]`, "[/color]", "colored text");
          setShowFormat(false);
        }}
      />

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0] || null)}
      />
      <input
        ref={photoCaptureRef}
        type="file"
        accept="image/*"
        capture
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0] || null)}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0] || null)}
      />
      <input
        ref={videoCaptureRef}
        type="file"
        accept="video/*"
        capture
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0] || null)}
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0] || null)}
      />

      {attachmentPreviewOpen && preview?.url && createPortal(
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/86 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={previewPanelRef}
            className="relative w-full max-w-[980px] overflow-hidden rounded-2xl border border-white/15 bg-black/35 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white/90">{preview.name}</p>
                {preview.sizeLabel && <p className="truncate text-[11px] text-white/60">{preview.sizeLabel}</p>}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={openAttachmentInNewTab}
                  className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                  aria-label="Open in new tab"
                >
                  <ExternalLink size={14} />
                  Open
                </button>
                <button
                  type="button"
                  onClick={downloadAttachment}
                  className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                  aria-label="Download attachment"
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (preview.image) replaceAttachment("photo");
                    else if (preview.video) replaceAttachment("video");
                    else replaceAttachment("file");
                    setAttachmentPreviewOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                  aria-label="Replace attachment"
                >
                  <FolderOpen size={14} />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={clearAttachment}
                  className="inline-flex items-center gap-1 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-50 transition hover:bg-rose-500/30"
                  aria-label="Remove attachment"
                >
                  <X size={14} />
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentPreviewOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/15"
                  aria-label="Close preview"
                  ref={previewCloseRef}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex h-[72vh] w-full items-center justify-center bg-black">
              {preview.pdf ? (
                <iframe
                  src={preview.url}
                  title="PDF preview"
                  className="h-full w-full bg-white"
                  sandbox="allow-same-origin allow-scripts"
                  referrerPolicy="no-referrer"
                />
              ) : preview.video ? (
                <video controls autoPlay preload="auto" playsInline className="h-full w-full object-contain">
                  <source src={preview.url} type={preview.type || undefined} />
                </video>
              ) : preview.image ? (
                <img src={preview.url} alt={preview.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 px-6 text-center text-white/80">
                  <Paperclip size={24} className="opacity-80" />
                  <p className="text-sm font-semibold">Preview not available</p>
                  <p className="text-xs text-white/55">Use Open or Download to view the file.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </form>
  );
}

function ToolButton({ children, label, onClick, active = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`glass-icon-btn disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-white/10 bg-white/30 text-accent dark:bg-white/7" : ""}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function ToolOption({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-accent hover:bg-accent-soft dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {icon}
      {label}
    </button>
  );
}

function FormatButton({ children, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-accent hover:bg-accent-soft dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-white/5"
      aria-label={label}
      title={label}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
