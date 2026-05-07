import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  accentColor: "#a855f7",
  setAccentColor: () => {},
  doodleStyle: "dots",
  setDoodleStyle: () => {},
  setSidebarColor: () => {},
  setChatPaneColor: () => {},
  isSidebarLight: true,
  isChatPaneLight: true
});

const THEME_STORAGE_KEY = "chat_color_mode";
const DOODLE_STORAGE_KEY = "chat_doodle_style";

function normalizeHex(color) {
  if (!color) return "";
  const raw = color.toString().trim();
  if (!raw) return "";
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.split("").map((c) => c + c).join("")}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`.toLowerCase();
  return "";
}

function normalizeTheme(theme) {
  const value = (theme || "").toString().trim().toLowerCase();
  if (value === "dark") return "dark";
  if (value === "light") return "light";
  return "";
}

function preferredTheme() {
  if (typeof window === "undefined") return "dark";
  const saved = normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  return saved || "dark";
}

function normalizeDoodleStyle(style) {
  const value = (style || "").toString().trim().toLowerCase();
  if (value === "dots") return "dots";
  if (value === "grid") return "grid";
  if (value === "hatch") return "hatch";
  if (value === "bubbles") return "bubbles";
  if (value === "icons") return "icons";
  if (value === "confetti") return "confetti";
  return "";
}

function preferredDoodleStyle() {
  if (typeof window === "undefined") return "dots";
  const saved = normalizeDoodleStyle(window.localStorage.getItem(DOODLE_STORAGE_KEY));
  return saved || "dots";
}

function preferredAccentColor() {
  if (typeof window === "undefined") return "#a855f7";
  const saved = window.localStorage.getItem("chat_accent_color");
  return normalizeHex(saved) || "#a855f7";
}

function readInitialColors() {
  if (typeof window === "undefined") {
    return { accentColor: "#a855f7", sidebarColor: "", chatPaneColor: "", migrated: false };
  }

  const savedAccent = normalizeHex(window.localStorage.getItem("chat_accent_color"));
  const savedSidebar = window.localStorage.getItem("chat_sidebar_color") || "";
  const savedPane = window.localStorage.getItem("chat_pane_color") || "";
  if (savedAccent) {
    return { accentColor: savedAccent, sidebarColor: savedSidebar, chatPaneColor: savedPane, migrated: false };
  }

  const legacy = normalizeHex(savedSidebar) || normalizeHex(savedPane);
  if (legacy) {
    return { accentColor: legacy, sidebarColor: "", chatPaneColor: "", migrated: true };
  }

  return { accentColor: "#a855f7", sidebarColor: savedSidebar, chatPaneColor: savedPane, migrated: false };
}

function isColorLight(color) {
  const normalized = normalizeHex(color);
  if (!normalized) return true; // default to light
  const hex = normalized.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r, g, b };
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixRgb(a, b, t) {
  const tt = Math.max(0, Math.min(1, Number(t) || 0));
  return {
    r: clamp255(a.r + (b.r - a.r) * tt),
    g: clamp255(a.g + (b.g - a.g) * tt),
    b: clamp255(a.b + (b.b - a.b) * tt)
  };
}

function rgbBrightness({ r, g, b }) {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function ensureReadableAccent(seedRgb) {
  const brightness = rgbBrightness(seedRgb);
  // If the chosen seed is very dark, UI elements (buttons/bubbles) become invisible on dark surfaces.
  // Lift the color toward white to keep the whole theme readable while keeping the same hue.
  if (brightness < 90) {
    const t = Math.max(0, Math.min(1, (160 - brightness) / Math.max(1, 255 - brightness)));
    return mixRgb(seedRgb, { r: 255, g: 255, b: 255 }, t);
  }
  // If the chosen seed is extremely light, slightly deepen it so borders/rings stay visible.
  if (brightness > 235) {
    const t = Math.max(0, Math.min(1, (brightness - 215) / Math.max(1, brightness)));
    return mixRgb(seedRgb, { r: 0, g: 0, b: 0 }, t);
  }
  return seedRgb;
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function rgba({ r, g, b }, a) {
  const alpha = Math.max(0, Math.min(1, Number(a) || 0));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function svgDataUrl(svg) {
  const raw = (svg || "").toString().trim();
  if (!raw) return "none";
  return `url("data:image/svg+xml,${encodeURIComponent(raw)}")`;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(preferredTheme);
  const [doodleStyle, setDoodleStyle] = useState(preferredDoodleStyle);
  const [initialColors] = useState(readInitialColors);
  const [sidebarColor, setSidebarColor] = useState(() => initialColors.sidebarColor);
  const [chatPaneColor, setChatPaneColor] = useState(() => initialColors.chatPaneColor);
  const [accentColor, setAccentColor] = useState(() => initialColors.accentColor || preferredAccentColor());

  useEffect(() => {
    const root = document.documentElement;
    const normalized = normalizeTheme(theme) || "dark";
    const isDark = normalized === "dark";
    root.classList.toggle("dark", isDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initialColors.migrated) return;
    window.localStorage.setItem("chat_sidebar_color", "");
    window.localStorage.setItem("chat_pane_color", "");
    window.localStorage.setItem("chat_accent_color", initialColors.accentColor);
  }, [initialColors]);

  useEffect(() => {
    const root = document.documentElement;
    const normalizedTheme = normalizeTheme(theme) || "dark";
    const isDarkTheme = normalizedTheme === "dark";
    const normalizedDoodle = normalizeDoodleStyle(doodleStyle) || "dots";

    const seedHex = normalizeHex(accentColor) || "#a855f7";
    const seedRgb = hexToRgb(seedHex) || { r: 168, g: 85, b: 247 };
    const accentUiRgb = ensureReadableAccent(seedRgb);
    const accentUiHex = rgbToHex(accentUiRgb);

    // Dark mode: lightly tint the UI surfaces with the chosen accent so the
    // whole page feels "themed" (e.g. green accent => subtle green tint).
    // Keep the tint subtle to preserve contrast and readability.
    const darkBase = { r: 0, g: 0, b: 0 };
    const body = mixRgb(darkBase, accentUiRgb, 0.07);
    const bgLift = mixRgb({ r: 10, g: 10, b: 10 }, accentUiRgb, 0.09);
    const bgDeep = mixRgb(darkBase, accentUiRgb, 0.05);
    const panel = mixRgb({ r: 12, g: 12, b: 12 }, accentUiRgb, 0.12);
    const panel2 = mixRgb({ r: 16, g: 16, b: 16 }, accentUiRgb, 0.16);

    const lightBase = { r: 248, g: 250, b: 252 }; // slate-50
    // Light mode: keep surfaces bright, but let the selected accent be clearly visible
    // (e.g. red should look like red, not washed-out pink).
    const lightBg = mixRgb(lightBase, accentUiRgb, 0.10);
    const lightBg2 = mixRgb(lightBase, accentUiRgb, 0.16);

    const accent50 = mixRgb(accentUiRgb, { r: 255, g: 255, b: 255 }, 0.88);
    const accent100 = mixRgb(accentUiRgb, { r: 255, g: 255, b: 255 }, 0.78);
    const accent200 = mixRgb(accentUiRgb, { r: 255, g: 255, b: 255 }, 0.65);
    const accent300 = mixRgb(accentUiRgb, { r: 255, g: 255, b: 255 }, 0.48);
    const accent400 = mixRgb(accentUiRgb, { r: 255, g: 255, b: 255 }, 0.24);
    const accent600 = mixRgb(accentUiRgb, { r: 0, g: 0, b: 0 }, 0.08);
    const accent700 = mixRgb(accentUiRgb, { r: 0, g: 0, b: 0 }, 0.16);
    const accent800 = mixRgb(accentUiRgb, { r: 0, g: 0, b: 0 }, 0.24);
    const accent900 = mixRgb(accentUiRgb, { r: 0, g: 0, b: 0 }, 0.34);
    const accent950 = mixRgb(accentUiRgb, { r: 0, g: 0, b: 0 }, 0.44);

    root.style.setProperty("--accent-rgb", `${accentUiRgb.r} ${accentUiRgb.g} ${accentUiRgb.b}`);
    root.style.setProperty("--accent-50-rgb", `${accent50.r} ${accent50.g} ${accent50.b}`);
    root.style.setProperty("--accent-100-rgb", `${accent100.r} ${accent100.g} ${accent100.b}`);
    root.style.setProperty("--accent-200-rgb", `${accent200.r} ${accent200.g} ${accent200.b}`);
    root.style.setProperty("--accent-300-rgb", `${accent300.r} ${accent300.g} ${accent300.b}`);
    root.style.setProperty("--accent-400-rgb", `${accent400.r} ${accent400.g} ${accent400.b}`);
    root.style.setProperty("--accent-500-rgb", `${accentUiRgb.r} ${accentUiRgb.g} ${accentUiRgb.b}`);
    root.style.setProperty("--accent-600-rgb", `${accent600.r} ${accent600.g} ${accent600.b}`);
    root.style.setProperty("--accent-700-rgb", `${accent700.r} ${accent700.g} ${accent700.b}`);
    root.style.setProperty("--accent-800-rgb", `${accent800.r} ${accent800.g} ${accent800.b}`);
    root.style.setProperty("--accent-900-rgb", `${accent900.r} ${accent900.g} ${accent900.b}`);
    root.style.setProperty("--accent-950-rgb", `${accent950.r} ${accent950.g} ${accent950.b}`);

    root.style.setProperty("--accent", accentUiHex);
    root.style.setProperty("--accent-contrast", isColorLight(accentUiHex) ? "#0b1220" : "#ffffff");
    const soft10 = isDarkTheme ? 0.12 : 0.24;
    const soft14 = isDarkTheme ? 0.16 : 0.32;
    const soft18 = isDarkTheme ? 0.20 : 0.40;
    const ringAlpha = isDarkTheme ? 0.40 : 0.35;
    const shadowAlpha = isDarkTheme ? 0.34 : 0.30;

    root.style.setProperty("--accent-soft-10", rgba(accentUiRgb, soft10));
    root.style.setProperty("--accent-soft-14", rgba(accentUiRgb, soft14));
    root.style.setProperty("--accent-soft-18", rgba(accentUiRgb, soft18));
    root.style.setProperty("--accent-ring", rgba(accentUiRgb, ringAlpha));
    root.style.setProperty("--accent-shadow", rgba(accentUiRgb, shadowAlpha));
    root.style.setProperty("--selection-bg", rgba(accentUiRgb, 0.30));
    root.style.setProperty("--selection-text", isDarkTheme ? "#f8fafc" : "#0b1220");
    root.style.setProperty("--body-bg-dark", rgbToHex(body));
    root.style.setProperty("--body-bg", rgbToHex(lightBg));

    root.style.setProperty("--panel-bg", rgba(panel, 0.92));
    root.style.setProperty("--panel-bg-2", rgba(panel2, 0.92));
    root.style.setProperty("--panel-border", rgba(accentUiRgb, 0.22));
    root.style.setProperty("--panel-border-soft", "rgba(255, 255, 255, 0.08)");
    root.style.setProperty("--panel-text", "#f8fafc");
    root.style.setProperty("--panel-muted", "rgba(226, 232, 240, 0.70)");

    const inkText = isDarkTheme ? { r: 248, g: 250, b: 252 } : { r: 15, g: 23, b: 42 };
    const inkMuted = isDarkTheme ? { r: 148, g: 163, b: 184 } : { r: 71, g: 85, b: 105 };
    root.style.setProperty("--ink", `${inkText.r} ${inkText.g} ${inkText.b}`);
    root.style.setProperty("--ink-muted", `${inkMuted.r} ${inkMuted.g} ${inkMuted.b}`);

    // Message bubble tokens (accent-aware, theme-safe).
    root.style.setProperty(
      "--bubble-in-bg",
      isDarkTheme
        ? `linear-gradient(180deg, ${rgba(bgLift, 0.58)}, ${rgba(bgDeep, 0.46)})`
        : `linear-gradient(180deg, ${rgba(lightBg2, 0.86)}, ${rgba(lightBg, 0.82)})`
    );
    root.style.setProperty(
      "--bubble-in-tint",
      isDarkTheme ? rgba(accentUiRgb, 0.10) : rgba(accentUiRgb, 0.08)
    );
    root.style.setProperty(
      "--bubble-in-border",
      isDarkTheme ? "rgba(255, 255, 255, 0.10)" : "rgba(15, 23, 42, 0.10)"
    );
    root.style.setProperty(
      "--bubble-in-text",
      `rgb(${inkText.r} ${inkText.g} ${inkText.b})`
    );
    root.style.setProperty(
      "--bubble-in-meta",
      isDarkTheme ? "rgba(148, 163, 184, 0.72)" : "rgba(71, 85, 105, 0.72)"
    );
    root.style.setProperty("--bubble-out-text", root.style.getPropertyValue("--accent-contrast") || (isColorLight(accentUiHex) ? "#0b1220" : "#ffffff"));
    root.style.setProperty(
      "--bubble-out-meta",
      isColorLight(accentUiHex) ? "rgba(11, 18, 32, 0.62)" : "rgba(255, 255, 255, 0.72)"
    );

    // Overlay / media viewer tokens (theme + accent aware).
    root.style.setProperty("--overlay-dim", isDarkTheme ? "rgba(0, 0, 0, 0.86)" : "rgba(2, 6, 23, 0.56)");
    root.style.setProperty("--overlay-surface", isDarkTheme ? "rgba(2, 6, 23, 0.44)" : "rgba(255, 255, 255, 0.72)");
    root.style.setProperty("--overlay-border", isDarkTheme ? "rgba(255, 255, 255, 0.10)" : "rgba(15, 23, 42, 0.10)");
    root.style.setProperty("--overlay-text", isDarkTheme ? "rgba(255, 255, 255, 0.94)" : "rgba(15, 23, 42, 0.94)");
    root.style.setProperty("--overlay-muted", isDarkTheme ? "rgba(255, 255, 255, 0.68)" : "rgba(51, 65, 85, 0.72)");
    root.style.setProperty("--overlay-ring", isDarkTheme ? "rgba(255, 255, 255, 0.30)" : rgba(accentUiRgb, 0.32));
    root.style.setProperty("--overlay-btn-bg", isDarkTheme ? "rgba(0, 0, 0, 0.28)" : "rgba(255, 255, 255, 0.55)");
    root.style.setProperty("--overlay-btn-bg-hover", isDarkTheme ? "rgba(0, 0, 0, 0.46)" : "rgba(255, 255, 255, 0.72)");
    root.style.setProperty("--overlay-btn-border", isDarkTheme ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.12)");
    root.style.setProperty("--overlay-grad-top", isDarkTheme ? "rgba(0, 0, 0, 0.62)" : "rgba(255, 255, 255, 0.70)");
    root.style.setProperty("--overlay-grad-mid", isDarkTheme ? "rgba(0, 0, 0, 0.28)" : "rgba(255, 255, 255, 0.35)");
    root.style.setProperty("--overlay-grad-bottom", isDarkTheme ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.78)");
    root.style.setProperty("--overlay-media-bg", isDarkTheme ? "rgba(0, 0, 0, 0.92)" : "rgba(255, 255, 255, 0.92)");

    root.style.setProperty(
      "--chat-bg-light",
      `radial-gradient(900px 520px at 10% -22%, ${rgba(accentUiRgb, 0.24)}, transparent 55%), radial-gradient(720px 520px at 100% -10%, ${rgba(accentUiRgb, 0.12)}, transparent 60%), linear-gradient(180deg, ${rgba(lightBg2, 0.98)}, ${rgba(lightBg, 0.96)})`
    );
    root.style.setProperty(
      "--chat-bg-dark",
      `linear-gradient(180deg, ${rgba(bgLift, 0.94)}, ${rgba(bgDeep, 0.98)})`
    );

    root.style.setProperty(
      "--thread-bg",
      isDarkTheme
        ? `linear-gradient(180deg, rgba(10, 10, 10, 0.94), rgba(0, 0, 0, 0.98))`
        : `radial-gradient(820px 540px at 10% -12%, ${rgba(accentUiRgb, 0.24)}, transparent 58%), radial-gradient(760px 540px at 102% -18%, ${rgba(accentUiRgb, 0.16)}, transparent 62%), radial-gradient(920px 720px at 26% 112%, ${rgba(accentUiRgb, 0.12)}, transparent 64%), linear-gradient(180deg, ${rgba(lightBg2, 0.98)}, ${rgba(lightBg, 0.96)})`
    );

    const ink = isDarkTheme ? { r: 255, g: 255, b: 255 } : { r: 15, g: 23, b: 42 };
    const inkAlpha = isDarkTheme ? 0.09 : 0.06;
    const accentAlpha = isDarkTheme ? 0.12 : 0.10;

    const dotPattern = `radial-gradient(circle at 1px 1px, ${rgba(ink, inkAlpha)} 1px, transparent 1.35px)`;
    const blobPattern = isDarkTheme
      ? "none"
      : `radial-gradient(12px 12px at 18% 28%, ${rgba(accentUiRgb, accentAlpha)} 0, transparent 62%), `
        + `radial-gradient(10px 10px at 78% 22%, ${rgba(accentUiRgb, accentAlpha * 0.9)} 0, transparent 62%), `
        + `radial-gradient(9px 9px at 66% 78%, ${rgba(accentUiRgb, accentAlpha * 0.7)} 0, transparent 62%)`;

    let pattern1 = dotPattern;
    let pattern2 = blobPattern;
    let pattern1Size = "18px 18px";
    let pattern2Size = "140px 140px";

    if (normalizedDoodle === "grid") {
      pattern1 = `linear-gradient(to bottom, ${rgba(ink, inkAlpha)} 0, ${rgba(ink, inkAlpha)} 1px, transparent 1px, transparent 26px)`;
      pattern2 = `linear-gradient(to right, ${rgba(ink, inkAlpha)} 0, ${rgba(ink, inkAlpha)} 1px, transparent 1px, transparent 26px)`;
      pattern1Size = "26px 26px";
      pattern2Size = "26px 26px";
    } else if (normalizedDoodle === "hatch") {
      const inkLine = rgba(ink, inkAlpha);
      const accentLine = rgba(accentUiRgb, accentAlpha);
      pattern1 = `linear-gradient(45deg, ${inkLine} 0, ${inkLine} 1px, transparent 1px, transparent 10px)`;
      pattern2 = `linear-gradient(-45deg, ${accentLine} 0, ${accentLine} 1px, transparent 1px, transparent 12px)`;
      pattern1Size = "18px 18px";
      pattern2Size = "22px 22px";
    } else if (normalizedDoodle === "bubbles") {
      pattern1 = `radial-gradient(circle at 8px 8px, ${rgba(ink, inkAlpha)} 1.2px, transparent 2.8px)`;
      pattern2 = `radial-gradient(circle at 18px 18px, ${rgba(accentUiRgb, accentAlpha)} 1.8px, transparent 4.6px)`;
      pattern1Size = "44px 44px";
      pattern2Size = "78px 78px";
    } else if (normalizedDoodle === "icons") {
      const iconInk = rgba(ink, isDarkTheme ? 0.055 : 0.04);
      const iconAccent = rgba(accentUiRgb, isDarkTheme ? 0.06 : 0.045);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="170" height="170" viewBox="0 0 170 170">
          <rect width="170" height="170" fill="transparent"/>

          <path d="M30 24l3.5 9.8 10.4.2-8.3 6 3.2 10-8.8-6.1-8.8 6.1 3.2-10-8.3-6 10.4-.2L30 24z"
            fill="none" stroke="${iconInk}" stroke-width="1.4" stroke-linejoin="round"/>

          <circle cx="128" cy="32" r="12" fill="none" stroke="${iconInk}" stroke-width="1.4"/>
          <path d="M123 35c1.4 2 3.2 3 5 3s3.6-1 5-3" fill="none" stroke="${iconInk}" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M124 29h0" stroke="${iconInk}" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M132 29h0" stroke="${iconInk}" stroke-width="2.4" stroke-linecap="round"/>

          <path d="M124 86c10-10 10-26 10-26s-16 0-26 10l-8 8 16 16 8-8z" fill="none" stroke="${iconAccent}" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M102 92l-10 10" stroke="${iconAccent}" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M112 102l-7 3 3-7" fill="none" stroke="${iconAccent}" stroke-width="1.4" stroke-linejoin="round"/>
          <circle cx="120" cy="72" r="3" fill="none" stroke="${iconAccent}" stroke-width="1.4"/>

          <path d="M22 102h30a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6v-18a6 6 0 0 1 6-6z"
            fill="none" stroke="${iconInk}" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M26 102l4-7h14l4 7" fill="none" stroke="${iconInk}" stroke-width="1.4" stroke-linejoin="round"/>
          <circle cx="37" cy="117" r="6" fill="none" stroke="${iconInk}" stroke-width="1.4"/>

          <path d="M82 120c0 10-10 18-24 18-3 0-6-.4-9-1.2l-10 4 3.5-9.2C38 128.5 36 124.5 36 120c0-10 10-18 24-18s22 8 22 18z"
            fill="none" stroke="${iconAccent}" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M48 118h14" stroke="${iconAccent}" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M48 124h10" stroke="${iconAccent}" stroke-width="1.4" stroke-linecap="round"/>

          <path d="M92 34h8" stroke="${iconAccent}" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M96 30v8" stroke="${iconAccent}" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M78 62h6" stroke="${iconInk}" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M81 59v6" stroke="${iconInk}" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M146 126h7" stroke="${iconInk}" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M149 123v7" stroke="${iconInk}" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      `.trim();
      pattern1 = svgDataUrl(svg);
      pattern2 = "none";
      pattern1Size = "170px 170px";
      pattern2Size = "140px 140px";
    } else if (normalizedDoodle === "confetti") {
      const confettiInk = rgba(ink, isDarkTheme ? 0.10 : 0.07);
      const confettiAccent = rgba(accentUiRgb, isDarkTheme ? 0.16 : 0.12);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
          <rect width="120" height="120" fill="transparent"/>
          <circle cx="18" cy="20" r="1.4" fill="${confettiInk}"/>
          <circle cx="52" cy="34" r="1.2" fill="${confettiAccent}"/>
          <circle cx="94" cy="22" r="1.6" fill="${confettiInk}"/>
          <circle cx="84" cy="66" r="1.1" fill="${confettiAccent}"/>
          <circle cx="26" cy="78" r="1.6" fill="${confettiAccent}"/>
          <circle cx="60" cy="92" r="1.2" fill="${confettiInk}"/>

          <path d="M34 16h6" stroke="${confettiAccent}" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M37 13v6" stroke="${confettiAccent}" stroke-width="1.4" stroke-linecap="round"/>

          <path d="M86 40h6" stroke="${confettiInk}" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M89 37v6" stroke="${confettiInk}" stroke-width="1.2" stroke-linecap="round"/>

          <path d="M18 52l7-3" stroke="${confettiInk}" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M22 56l3-7" stroke="${confettiInk}" stroke-width="1.3" stroke-linecap="round"/>

          <path d="M64 56l9 2" stroke="${confettiAccent}" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M63 64l8-5" stroke="${confettiAccent}" stroke-width="1.4" stroke-linecap="round"/>

          <path d="M96 88l8-2" stroke="${confettiAccent}" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M102 94l-6-6" stroke="${confettiAccent}" stroke-width="1.4" stroke-linecap="round"/>

          <path d="M38 104l6-4" stroke="${confettiInk}" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M44 110l-6-6" stroke="${confettiInk}" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      `.trim();
      pattern1 = svgDataUrl(svg);
      pattern2 = "none";
      pattern1Size = "120px 120px";
      pattern2Size = "140px 140px";
    }

    root.style.setProperty("--thread-pattern-1", pattern1);
    root.style.setProperty("--thread-pattern-2", pattern2);
    root.style.setProperty("--thread-pattern-1-size", pattern1Size);
    root.style.setProperty("--thread-pattern-2-size", pattern2Size);

    if (sidebarColor) {
      root.style.setProperty("--sidebar-bg-color", sidebarColor);
      root.style.setProperty("--sidebar-text-light", isColorLight(sidebarColor) ? "0" : "1");
    } else {
      root.style.removeProperty("--sidebar-bg-color");
      root.style.removeProperty("--sidebar-text-light");
    }
    if (chatPaneColor) {
      root.style.setProperty("--chatpane-bg-color", chatPaneColor);
      root.style.setProperty("--chatpane-text-light", isColorLight(chatPaneColor) ? "0" : "1");
    } else {
      root.style.removeProperty("--chatpane-bg-color");
      root.style.removeProperty("--chatpane-text-light");
    }
    window.localStorage.setItem("chat_sidebar_color", sidebarColor);
    window.localStorage.setItem("chat_pane_color", chatPaneColor);
    window.localStorage.setItem("chat_accent_color", seedHex);
    window.localStorage.setItem(DOODLE_STORAGE_KEY, normalizedDoodle);
  }, [accentColor, sidebarColor, chatPaneColor, theme, doodleStyle]);

  const value = useMemo(() => ({
    theme: normalizeTheme(theme) || "dark",
    setTheme: (next) => setTheme(normalizeTheme(next) || "dark"),
    toggleTheme: () => setTheme((prev) => ((normalizeTheme(prev) || "dark") === "dark" ? "light" : "dark")),
    accentColor: normalizeHex(accentColor) || "#a855f7",
    setAccentColor: (value) => setAccentColor(normalizeHex(value) || "#a855f7"),
    doodleStyle: normalizeDoodleStyle(doodleStyle) || "dots",
    setDoodleStyle: (next) => setDoodleStyle(normalizeDoodleStyle(next) || "dots"),
    sidebarColor,
    chatPaneColor,
    setSidebarColor,
    setChatPaneColor,
    isSidebarLight: isColorLight(sidebarColor),
    isChatPaneLight: isColorLight(chatPaneColor)
  }), [accentColor, sidebarColor, chatPaneColor, theme, doodleStyle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
