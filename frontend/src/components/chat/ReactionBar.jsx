import twemoji from "twemoji";
import { Plus } from "lucide-react";

function EmojiIcon({ value }) {
  return (
    <span
      className="inline-flex items-center justify-center text-[18px] leading-none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: twemoji.parse(value, { folder: "svg", ext: ".svg", className: "twemoji-icon" })
      }}
    />
  );
}

function ReactionButton({ children, label }) {
  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-700 shadow-sm transition hover:border-accent hover:bg-accent-soft active:scale-95 focus-visible:outline-none focus-visible:ring-2 ring-accent dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export default function ReactionBar() {
  return (
    <div className="glass-bar inline-flex items-center gap-2 rounded-full px-3 py-2 ring-1 ring-accent shadow-[0_18px_52px_rgb(var(--accent-500-rgb)_/_0.30)]">
      <ReactionButton label="More reactions">
        <Plus size={18} />
      </ReactionButton>
      <ReactionButton label="Love">
        <EmojiIcon value={"\u2764\uFE0F"} />
      </ReactionButton>
      <ReactionButton label="Laugh">
        <EmojiIcon value={"\uD83D\uDE02"} />
      </ReactionButton>
      <ReactionButton label="Wow">
        <EmojiIcon value={"\uD83D\uDE2E"} />
      </ReactionButton>
      <ReactionButton label="Sad">
        <EmojiIcon value={"\uD83D\uDE22"} />
      </ReactionButton>
      <ReactionButton label="Like">
        <EmojiIcon value={"\uD83D\uDC4D"} />
      </ReactionButton>
    </div>
  );
}

