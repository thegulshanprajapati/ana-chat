import { useEffect, useMemo, useRef, useState } from "react";
import { useLayoutEffect } from "react";
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
  X,
  IndianRupee,
  Mic,
  RefreshCw
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

function richComposerHtml(value) {
  let text = escapeHtml(value || "");

  // Bold: **text**
  text = text.replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>");

  // Italic: *text*
  text = text.replace(/\*(?!\*)([^\n*]+?)\*(?!\*)/g, "<em>$1</em>");

  // Underline: __text__
  text = text.replace(/__([^_\n][\s\S]*?)__/g, "<u>$1</u>");

  // Strike: ~~text~~
  text = text.replace(/~{2,}([^\n]+?)~{2,}/g, "<s>$1</s>");

  // Glow: [glow]text[/glow]
  text = text.replace(/\[glow\]([\s\S]*?)\[\/glow\]/gi, '<span class="message-glow">$1</span>');

  // Color: [color:#ff05d1]text[/color]
  text = text.replace(
    /\[color\s*[:=]\s*(#[0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/color\]/gi,
    '<span style="color:$1">$2</span>'
  );

  return twemoji.parse(text, {
    folder: "svg",
    ext: ".svg",
    className: "twemoji-icon twemoji-icon--composer"
  });
}

function replaceShortcodes(val) {
  return (val || "")
    .replace(/:\)/g, "😊")
    .replace(/:-\)/g, "😊")
    .replace(/:\(/g, "☹️")
    .replace(/:-\(/g, "☹️")
    .replace(/<3/g, "❤️")
    .replace(/:D/g, "😀")
    .replace(/:P/g, "😛")
    .replace(/;\)/g, "😉")
    .replace(/B\)/g, "😎")
    .replace(/\(y\)/gi, "👍");
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
  const cameraVideoRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraFacing, setCameraFacing] = useState("user");
  const [selectedFilter, setSelectedFilter] = useState("normal");
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let activeStream = null;
    if (cameraOpen) {
      setCameraError("");
      const constraints = {
        video: { facingMode: cameraFacing },
        audio: false
      };
      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          activeStream = stream;
          setCameraStream(stream);
          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error("Camera access failed:", err);
          setCameraError("Could not access your camera. Make sure permissions are granted.");
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraOpen, cameraFacing]);

  const handleCapture = () => {
    if (!cameraVideoRef.current) return;
    const video = cameraVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    
    let filterStr = "none";
    if (selectedFilter === "grayscale") filterStr = "grayscale(1)";
    else if (selectedFilter === "sepia") filterStr = "sepia(1)";
    else if (selectedFilter === "invert") filterStr = "invert(1)";
    else if (selectedFilter === "warm") filterStr = "contrast(1.25) brightness(0.95) saturate(1.5)";
    else if (selectedFilter === "blur") filterStr = "blur(2px)";
    
    ctx.filter = filterStr;

    // If front camera, mirror image on canvas too
    if (cameraFacing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera_shot_${Date.now()}.jpg`, { type: "image/jpeg" });
        validateAndSet(file);
        closeCamera();
      }
    }, "image/jpeg", 0.90);
  };

  const toggleCameraFacing = () => {
    setCameraFacing(prev => prev === "user" ? "environment" : "user");
  };

  const handleGalleryClick = () => {
    imageRef.current?.click();
    closeCamera();
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
    setCameraError("");
  };
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
  const canSend = Boolean(text.trim() || attachment) && !disabled && !sending;
  const COMPOSER_MAX_HEIGHT_PX = 112;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);



  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], "voice-message.webm", { type: "audio/webm" });
        
        try {
          setSending(true);
          await onSend?.({
            body: "",
            media: audioFile,
            replyToMessageId: replyTo?.id || null
          });
          onCancelReply?.();
        } catch (err) {
          notify?.({
            type: "error",
            title: "Voice message failed",
            message: err?.response?.data?.message || err?.message || "Unable to send voice message."
          });
        } finally {
          setSending(false);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error(err);
      notify?.({
        type: "error",
        title: "Microphone Access Denied",
        message: "Please allow microphone access to record voice messages."
      });
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  };

  const cleanupRecording = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

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

  useEffect(() => {
    if (disabled) return;
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [disabled]);

  const syncComposerHeights = () => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = "0px";
    const nextHeight = Math.min(input.scrollHeight || 0, COMPOSER_MAX_HEIGHT_PX);
    input.style.height = `${Math.max(nextHeight, 44)}px`;
    input.style.overflowY = (input.scrollHeight || 0) > COMPOSER_MAX_HEIGHT_PX ? "auto" : "hidden";

    if (overlayRef.current) overlayRef.current.style.height = input.style.height;
  };

  useLayoutEffect(() => {
    syncComposerHeights();
  }, [text]);

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

    const previousText = text;
    const previousAttachment = attachment;
    const previousShowEmoji = showEmoji;
    const previousShowTools = showTools;
    const previousShowFormat = showFormat;

    submitLockRef.current = true;
    setSending(true);

    setText("");
    setShowEmoji(false);
    setShowTools(false);
    setShowFormat(false);
    clearAttachment();
    requestAnimationFrame(syncComposerHeights);

    try {
      await onSend?.({
        body: previousText.trim(),
        media: previousAttachment,
        replyToMessageId: replyTo?.id || null
      });
      onCancelReply?.();
    } catch (err) {
      setText(previousText);
      setAttachment(previousAttachment);
      setShowEmoji(previousShowEmoji);
      setShowTools(previousShowTools);
      setShowFormat(previousShowFormat);
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
      className={`w-full relative shrink-0 border-t border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-[var(--panel-bg-2)] px-4 py-2.5 flex flex-col gap-2 ${dragActive ? "ring-2 ring-accent" : ""}`}
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

      {isRecording ? (
        <div className="flex items-center justify-between w-full h-[44px] px-4 bg-slate-200/50 dark:bg-slate-800/50 rounded-full transition-all">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-semibold text-rose-500">Recording Voice Note</span>
            <span className="text-xs font-semibold font-mono text-slate-600 dark:text-slate-300">
              {Math.floor(recordingDuration / 60).toString().padStart(2, "0")}:
              {(recordingDuration % 60).toString().padStart(2, "0")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-full transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              <SendHorizonal size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 w-full">
          {/* Left Buttons: Emoji & Text Format */}
          <div className="flex items-center gap-0.5">
            <ComposerIconButton
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
              <Smile size={19} />
            </ComposerIconButton>
            
            <ComposerIconButton
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
              <Type size={19} />
            </ComposerIconButton>
          </div>

          {/* Textarea Area */}
          <div className="relative flex-1 min-h-[36px]">
            <div
              ref={overlayRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 min-h-[36px] overflow-hidden px-2 py-[7px] text-[15px] leading-5 text-slate-900 outline-none whitespace-pre-wrap break-words dark:text-slate-50 font-normal"
              dangerouslySetInnerHTML={{ __html: richComposerHtml(text) }}
            />
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => {
                const replaced = replaceShortcodes(e.target.value);
                setText(replaced);
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
                const ctrl = event.ctrlKey || event.metaKey;
                const key = event.key.toLowerCase();

                // Format Shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
                if (ctrl) {
                  if (key === "b") {
                    event.preventDefault();
                    wrapSelection("**", "**", "bold");
                    return;
                  }
                  if (key === "i") {
                    event.preventDefault();
                    wrapSelection("*", "*", "italic");
                    return;
                  }
                  if (key === "u") {
                    event.preventDefault();
                    wrapSelection("__", "__", "underline");
                    return;
                  }
                  if (key === "e") {
                    event.preventDefault();
                    setShowEmoji((v) => !v);
                    setShowTools(false);
                    setShowFormat(false);
                    return;
                  }
                }

                // Alt + Number emoji shortcuts
                if (event.altKey) {
                  const emojiMap = {
                    "1": "😊",
                    "2": "❤️",
                    "3": "👍",
                    "4": "😂",
                    "5": "🔥",
                    "6": "😍",
                    "7": "🎉",
                    "8": "👏",
                    "9": "✨"
                  };
                  const targetEmoji = emojiMap[event.key];
                  if (targetEmoji) {
                    event.preventDefault();
                    setText((prev) => prev + targetEmoji);
                    return;
                  }
                }

                if (!enterToSend) return;
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              disabled={disabled}
              placeholder={disabled
                ? (disabledReason || "Messaging disabled")
                : "Message"}
              rows={1}
              className="relative z-10 min-h-[36px] w-full resize-none bg-transparent px-2 py-[7px] text-[15px] leading-5 text-transparent caret-slate-900 outline-none placeholder:text-slate-500/90 disabled:cursor-not-allowed disabled:placeholder:text-slate-400 dark:caret-slate-50 dark:placeholder:text-white/45 font-normal"
              aria-label="Message input"
            />
          </div>

          {/* Right Buttons: Attach, Camera */}
          <div className="flex items-center gap-0.5">
            <ComposerIconButton
              label="Attach options"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setShowTools((v) => !v);
                setShowEmoji(false);
                setShowFormat(false);
              }}
              active={showTools}
            >
              <Paperclip size={19} />
            </ComposerIconButton>

            <ComposerIconButton
              label="Camera"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setCameraOpen(true);
              }}
            >
              <Camera size={19} />
            </ComposerIconButton>
          </div>

          {/* Separate Circular Mic/Send Button */}
          {canSend ? (
            <button
              type="submit"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white shadow-md transition duration-150 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)", "--tw-ring-color": "var(--accent-ring)" }}
              aria-label="Send message"
            >
              <SendHorizonal size={18} className={sending ? "animate-pulse" : ""} />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white shadow-md transition duration-150 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)", "--tw-ring-color": "var(--accent-ring)" }}
              aria-label="Record voice note"
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      )}

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

      {cameraOpen && createPortal(
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-[580px] overflow-hidden rounded-3xl border shadow-2xl flex flex-col" style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--border-color, rgba(255,255,255,0.1))", color: "var(--text-primary)" }}>
            
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ backgroundColor: "var(--panel-bg-2)", borderColor: "var(--border-color, rgba(255,255,255,0.1))" }}>
              <div className="flex items-center gap-2">
                <Camera size={18} style={{ color: "var(--accent)" }} />
                <span className="font-semibold text-sm">Take a Photo</span>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-full p-1.5 hover:bg-white/10 transition"
                aria-label="Close camera"
                style={{ color: "var(--text-secondary)" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Preview */}
            <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
              {cameraError ? (
                <div className="text-center p-6 space-y-4">
                  <p className="text-sm text-rose-300 max-w-[320px] mx-auto">{cameraError}</p>
                  <button
                    type="button"
                    onClick={handleGalleryClick}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition shadow-lg active:scale-95"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    <FolderOpen size={14} />
                    Choose from Gallery
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    className={`h-full w-full object-cover transition-all ${
                      selectedFilter === "grayscale" ? "grayscale" :
                      selectedFilter === "sepia" ? "sepia" :
                      selectedFilter === "invert" ? "invert" :
                      selectedFilter === "warm" ? "contrast-125 brightness-95 saturate-150" :
                      selectedFilter === "blur" ? "blur-[2px]" : "filter-none"
                    } ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
                  />
                  {!cameraStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <RefreshCw size={24} className="animate-spin text-white/70" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Filters bar */}
            {!cameraError && (
              <div className="px-5 py-3.5 border-t" style={{ backgroundColor: "var(--panel-bg-2)", borderColor: "var(--border-color, rgba(255,255,255,0.1))" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-secondary)" }}>Camera Filters</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {[
                    { id: "normal", label: "None" },
                    { id: "grayscale", label: "Mono" },
                    { id: "sepia", label: "Sepia" },
                    { id: "invert", label: "Invert" },
                    { id: "warm", label: "Warm" },
                    { id: "blur", label: "Soft Focus" }
                  ].map(f => {
                    const isSelected = selectedFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFilter(f.id)}
                        className="shrink-0 rounded-full px-3.5 py-1 text-xs font-medium transition active:scale-95"
                        style={{
                          backgroundColor: isSelected ? "var(--accent)" : "rgba(255, 255, 255, 0.05)",
                          color: isSelected ? "#fff" : "var(--text-primary)"
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between border-t px-6 py-4" style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--border-color, rgba(255,255,255,0.1))" }}>
              <button
                type="button"
                onClick={handleGalleryClick}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition active:scale-95"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", color: "var(--text-primary)" }}
                title="Select from gallery"
              >
                <FolderOpen size={16} />
                Gallery
              </button>

              <button
                type="button"
                onClick={handleCapture}
                disabled={!cameraStream}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition duration-150 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--accent)" }}
                aria-label="Capture photo"
              >
                <div className="h-4.5 w-4.5 rounded-full bg-white active:scale-75 transition-all" />
              </button>

              <button
                type="button"
                onClick={toggleCameraFacing}
                disabled={!!cameraError}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", color: "var(--text-primary)" }}
                title="Switch Camera"
              >
                <RefreshCw size={16} />
                Rotate
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

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
      className={`composer-icon-btn inline-flex h-10 w-10 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-45 ${
        active ? "composer-icon-btn--active text-accent" : ""
      }`}
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

function ComposerIconButton({ children, label, onClick, active = false, disabled = false, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200 transition duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${active ? "text-accent dark:text-accent" : ""} ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
