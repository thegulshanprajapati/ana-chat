import { useEffect, useRef, useState } from "react";
import { MoreVertical, Settings, UserPen, LogOut, Shield, PhoneCall } from "lucide-react";
import Avatar from "../common/Avatar";

export default function SidebarHeader({
  me,
  onOpenProfile,
  onOpenSettings,
  onOpenCallLogs,
  onAdmin,
  onLogout,
  isSidebarLight = true,
  hasCustomColor = false,
  compactMode = false
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleClick(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const isAdmin = Boolean(me?.isAdmin) || me?.role === "admin";
  const headerBorderClass = hasCustomColor
    ? (isSidebarLight ? "border-slate-200/70" : "border-white/10")
    : "border-slate-200/70 dark:border-slate-800/70";

  const titleClass = hasCustomColor
    ? (isSidebarLight ? "text-slate-900" : "text-white")
    : "text-slate-900 dark:text-slate-100";

  const subtitleClass = hasCustomColor
    ? (isSidebarLight ? "text-slate-600" : "text-white/70")
    : "text-slate-500 dark:text-slate-400";

  const iconTone = hasCustomColor
    ? (isSidebarLight ? "light" : "dark")
    : "default";

  return (
    <div className={`flex items-center justify-between border-b ${headerBorderClass} ${compactMode ? "px-3 py-3" : "px-4 py-4"}`}>
      <div className={`flex min-w-0 items-center ${compactMode ? "gap-2.5" : "gap-3"}`}>
        <Avatar name={me?.name} src={me?.avatar_url} size={compactMode ? 38 : 42} />
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${titleClass}`}>{me?.name || "User"}</p>
          <p className={`truncate text-xs ${subtitleClass}`}>{me?.mobile || me?.email || ""}</p>
        </div>
      </div>

      <div className="relative flex items-center gap-1" ref={menuRef}>
        <IconAction tone={iconTone} label="Edit profile" onClick={onOpenProfile} className="hidden sm:inline-flex">
          <UserPen size={16} />
        </IconAction>
        <IconAction tone={iconTone} label="Settings" onClick={onOpenSettings} className="hidden sm:inline-flex">
          <Settings size={16} />
        </IconAction>
        {onOpenCallLogs && (
          <IconAction tone={iconTone} label="Call logs" onClick={onOpenCallLogs} className="hidden sm:inline-flex">
            <PhoneCall size={16} />
          </IconAction>
        )}
        {isAdmin && (
          <IconAction tone={iconTone} label="Admin panel" onClick={onAdmin} className="hidden sm:inline-flex">
            <Shield size={16} />
          </IconAction>
        )}
        <IconAction tone={iconTone} label="Open account menu" onClick={() => setMenuOpen((v) => !v)}>
          <MoreVertical size={16} />
        </IconAction>

        {menuOpen && (
          <div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <MenuButton
              label="Edit profile"
              icon={<UserPen size={14} />}
              className="sm:hidden"
              onClick={() => {
                setMenuOpen(false);
                onOpenProfile?.();
              }}
            />
            <MenuButton
              label="Settings"
              icon={<Settings size={14} />}
              className="sm:hidden"
              onClick={() => {
                setMenuOpen(false);
                onOpenSettings?.();
              }}
            />
            {onOpenCallLogs && (
              <MenuButton
                label="Call logs"
                icon={<PhoneCall size={14} />}
                onClick={() => {
                  setMenuOpen(false);
                  onOpenCallLogs?.();
                }}
              />
            )}
            {isAdmin && (
              <MenuButton
                label="Admin panel"
                icon={<Shield size={14} />}
                className="sm:hidden"
                onClick={() => {
                  setMenuOpen(false);
                  onAdmin?.();
                }}
              />
            )}
            <MenuButton
              label="Logout"
              icon={<LogOut size={14} />}
              danger
              onClick={() => {
                setMenuOpen(false);
                onLogout?.();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function IconAction({ children, label, onClick, className = "", tone = "default" }) {
  const toneClass = tone === "dark"
    ? "text-white/80 hover:bg-white/10 hover:text-white"
    : tone === "light"
      ? "text-slate-600 hover:bg-black/5 hover:text-slate-900"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl p-2 transition focus-visible:outline-none focus-visible:ring-2 ring-accent ${toneClass} ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function MenuButton({ label, icon, onClick, danger = false, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
        danger
          ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/20"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      } ${className}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
