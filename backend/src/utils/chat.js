import { formatDayLabel } from "./time";

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function mediaSrc(uploadBase, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/uploads/")) return `${uploadBase}${path}`;
  if (path.startsWith("uploads/")) return `${uploadBase}/${path}`;
  return `${uploadBase}/uploads/${path}`;
}

export function isVideoMedia(path = "") {
  return /\.(mp4|mov|webm|m4v|ogg|avi|mkv)$/i.test(path);
}

export const CHAT_BACKGROUND_PRESETS = [
  {
    id: "ocean",
    label: "Nebula",
    image: "linear-gradient(135deg, rgb(0 0 0 / 0.95) 0%, rgb(var(--accent-800-rgb) / 0.92) 48%, rgb(var(--accent-400-rgb) / 0.96) 100%)"
  },
  {
    id: "sunset",
    label: "Sunset",
    image: "linear-gradient(135deg, rgb(var(--accent-950-rgb) / 0.92) 0%, rgb(var(--accent-700-rgb) / 0.92) 48%, rgb(var(--accent-300-rgb) / 0.96) 100%)"
  },
  {
    id: "midnight",
    label: "Midnight",
    image: "linear-gradient(140deg, rgb(0 0 0 / 0.96) 0%, rgb(var(--accent-950-rgb) / 0.78) 45%, rgb(var(--accent-900-rgb) / 0.86) 100%)"
  },
  {
    id: "mint",
    label: "Mint",
    image: "linear-gradient(135deg, rgb(0 0 0 / 0.92) 0%, rgb(var(--accent-800-rgb) / 0.92) 45%, rgb(var(--accent-300-rgb) / 0.96) 100%)"
  },
  {
    id: "rose",
    label: "Rose",
    image: "linear-gradient(135deg, rgb(var(--accent-950-rgb) / 0.90) 0%, rgb(var(--accent-700-rgb) / 0.92) 45%, rgb(var(--accent-300-rgb) / 0.98) 100%)"
  },
  {
    id: "graphite",
    label: "Graphite",
    image: "linear-gradient(140deg, #111827 0%, #1f2937 50%, #374151 100%)"
  }
];

const PRESET_MAP = CHAT_BACKGROUND_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = preset;
  return acc;
}, {});

export function chatBackgroundStyle(background, uploadBase) {
  const value = (background || "").toString().trim();
  if (!value) return null;

  if (value.startsWith("preset:")) {
    const presetId = value.slice("preset:".length).trim().toLowerCase();
    const preset = PRESET_MAP[presetId];
    if (!preset) return null;
    return {
      "--thread-bg-1": preset.image,
      "--thread-bg-2": "none",
      "--thread-pattern-1": "none",
      "--thread-pattern-2": "none"
    };
  }

  const media = mediaSrc(uploadBase, value);
  if (!media) return null;
  return {
    "--thread-bg-1": "linear-gradient(180deg, rgb(var(--accent-950-rgb) / 0.26), rgb(0 0 0 / 0.60))",
    "--thread-bg-2": `url("${media}")`,
    "--thread-pattern-1": "none",
    "--thread-pattern-2": "none"
  };
}

export function groupMessages(messages = []) {
  const groups = [];
  let current = null;
  let previousMessageDate = null;

  for (const message of messages) {
    const date = toDate(message.created_at);
    if (!date) continue;

    if (!previousMessageDate || !sameDay(previousMessageDate, date)) {
      groups.push({ type: "day", label: formatDayLabel(date), dayKey: date.toDateString() });
      current = null;
    }

    const sameSender = current && current.senderId === message.sender_id;
    const closeInTime = current && date - current.lastDate <= 5 * 60 * 1000;

    if (!sameSender || !closeInTime) {
      current = {
        type: "group",
        senderId: message.sender_id,
        messages: [message],
        lastDate: date,
        key: `${message.sender_id}-${message.id}`
      };
      groups.push(current);
    } else {
      current.messages.push(message);
      current.lastDate = date;
    }

    previousMessageDate = date;
  }

  return groups;
}
