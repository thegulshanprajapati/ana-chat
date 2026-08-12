/**
 * ReactionTray
 * ─────────────
 * Slide-up emoji tray shown above the call controls.
 * Throttled to 1 reaction per 1.5s to prevent spamming.
 * Respects prefers-reduced-motion.
 *
 * Props
 * ─────
 * open        boolean
 * onClose     () => void
 * onReact     (emoji: string) => void
 */
import { useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_REACTIONS } from "../../utils/expressionReactionEngine";

const THROTTLE_MS = 1500;

export default function ReactionTray({ open, onClose, onReact }) {
  const lastSentRef  = useRef(0);
  const prefersReduce = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    : false;

  const handleReact = useCallback((emoji) => {
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) return;
    lastSentRef.current = now;
    onReact?.(emoji);
    onClose?.();
  }, [onReact, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Tap-outside-to-close backdrop (invisible) */}
          <button
            type="button"
            onClick={onClose}
            className="fixed inset-0 z-[35]"
            aria-label="Close reaction tray"
            tabIndex={-1}
          />

          {/* Tray panel */}
          <motion.div
            role="toolbar"
            aria-label="Reactions"
            initial={prefersReduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={prefersReduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className="
              absolute bottom-[88px] left-1/2 -translate-x-1/2
              z-[36] flex flex-wrap items-center justify-center gap-1.5
              px-4 py-3 rounded-[26px]
              bg-slate-900/90 backdrop-blur-xl
              border border-white/12 shadow-[0_8px_40px_rgba(0,0,0,0.6)]
              max-w-[340px] sm:max-w-[380px]
            "
          >
            {ALL_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReact(emoji)}
                aria-label={`React with ${emoji}`}
                className="
                  flex items-center justify-center
                  h-10 w-10 rounded-full text-xl
                  hover:bg-white/15 hover:scale-125
                  active:scale-95
                  transition-all duration-150
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40
                "
                style={{ fontSize: "22px" }}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
