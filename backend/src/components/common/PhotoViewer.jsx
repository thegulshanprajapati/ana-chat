import { useState } from "react";
import { X, MoreVertical, ArrowLeft, ArrowRight, Download, Wallpaper, Share2, Forward } from "lucide-react";

export default function PhotoViewer({
  src,
  alt = "media",
  open,
  onClose,
  onDownload,
  onForward,
  onSetWallpaper,
  onSendToStatus,
  showArrows = false,
  onPrev,
  onNext,
  info = null,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative max-w-[92vw] max-h-[92vh] flex flex-col items-center justify-center animate-scaleIn">
        <img
          src={src}
          alt={alt}
          className="rounded-2xl shadow-2xl max-h-[80vh] max-w-[90vw] object-contain border border-white/20"
          style={{ transition: "box-shadow 0.2s" }}
        />
        <button
          className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 shadow-lg"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={22} />
        </button>
        <button
          className="absolute top-4 right-16 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 shadow-lg"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More"
        >
          <MoreVertical size={22} />
        </button>
        {menuOpen && (
          <div className="absolute top-16 right-8 bg-white rounded-xl shadow-2xl py-2 w-48 flex flex-col z-10 border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onDownload}><Download size={16}/>Download</button>
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onForward}><Forward size={16}/>Forward</button>
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onSetWallpaper}><Wallpaper size={16}/>Set as wallpaper</button>
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onSendToStatus}><Share2 size={16}/>Send to status</button>
          </div>
        )}
        {showArrows && (
          <>
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 shadow-lg"
              onClick={onPrev}
              aria-label="Previous"
            >
              <ArrowLeft size={22} />
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 shadow-lg"
              onClick={onNext}
              aria-label="Next"
            >
              <ArrowRight size={22} />
            </button>
          </>
        )}
        {info && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white rounded-xl px-4 py-2 text-sm shadow-lg">
            {info}
          </div>
        )}
      </div>
    </div>
  );
}

// Add this to your tailwind.config.js for animation:
// theme: { extend: { keyframes: { scaleIn: { '0%': { transform: 'scale(0.92)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } } }, animation: { scaleIn: 'scaleIn 0.22s cubic-bezier(.32,2,.55,.27) both' } } }
