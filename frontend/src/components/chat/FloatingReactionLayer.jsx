/**
 * FloatingReactionLayer
 * ──────────────────────
 * GPU-friendly floating emoji animations rendered as an overlay over
 * the video feed. Uses CSS @keyframes via inline style injection so
 * the main bundle stays lean. Auto-cleans finished nodes.
 *
 * Props
 * ─────
 * reactions   Array<{ id, emoji, mine, isCouple? }>  — incoming reactions
 * onReactionClick (id, emoji) => void                — tap-to-explode
 * isCouple    boolean  — add couple-flavored effect variants
 */
import { useEffect, useId, useRef, useState } from "react";
import { getExplosionParticles } from "../../utils/expressionReactionEngine";

/* Inject global keyframes once */
const KF_ID = "__float_reaction_kf__";
function injectKeyframes() {
  if (typeof document === "undefined" || document.getElementById(KF_ID)) return;
  const style = document.createElement("style");
  style.id = KF_ID;
  style.textContent = `
    @keyframes floatUp {
      0%   { transform: translateY(0)   translateX(0)   scale(1)   rotate(0deg); opacity: 1; }
      30%  { transform: translateY(-30%)  translateX(8%)  scale(1.2) rotate(5deg); opacity: 1; }
      60%  { transform: translateY(-65%)  translateX(-5%) scale(1)   rotate(-3deg); opacity: 0.8; }
      100% { transform: translateY(-120%) translateX(4%)  scale(0.7) rotate(2deg); opacity: 0; }
    }
    @keyframes floatUpAngry {
      0%   { transform: translateY(0)  rotate(0deg)  scale(1);   opacity: 1; }
      15%  { transform: translateY(-5%) rotate(-8deg) scale(1.1); opacity: 1; }
      30%  { transform: translateY(-10%) rotate(8deg) scale(1.2); opacity: 1; }
      45%  { transform: translateY(-20%) rotate(-6deg) scale(1.1);opacity: 1; }
      100% { transform: translateY(-90%) rotate(3deg)  scale(0.6); opacity: 0; }
    }
    @keyframes floatUpLaugh {
      0%   { transform: translateY(0)   scale(1)   rotate(0deg); opacity: 1; }
      20%  { transform: translateY(-15%) scale(1.3) rotate(-5deg); opacity: 1; }
      40%  { transform: translateY(-30%) scale(1.1) rotate(5deg);  opacity: 1; }
      100% { transform: translateY(-100%) scale(0.5) rotate(-2deg); opacity: 0; }
    }
    @keyframes floatUpSparkle {
      0%   { transform: translateY(0)  scale(0.6); opacity: 0.8; }
      30%  { transform: translateY(-20%) scale(1.4); opacity: 1; }
      100% { transform: translateY(-100%) scale(0.3); opacity: 0; }
    }
    @keyframes coupleFloat {
      0%   { transform: translateY(0) scale(0.8) rotate(0deg); opacity: 0.9; }
      50%  { transform: translateY(-40%) scale(1.2) rotate(8deg); opacity: 1; }
      100% { transform: translateY(-110%) scale(0.5) rotate(-5deg); opacity: 0; }
    }
    @keyframes explodeParticle {
      0%   { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) scale(0.4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

const DURATION_MS   = 2800;
const EMOJI_SIZE    = 36;
const MAX_FLOATING  = 8;

function pickAnimation(emoji) {
  if (["😡", "🔥", "💥"].includes(emoji)) return "floatUpAngry";
  if (["😂", "🤣"].includes(emoji))        return "floatUpLaugh";
  if (["✨", "⭐", "💫"].includes(emoji))   return "floatUpSparkle";
  if (["❤️", "💕", "🥰", "💖"].includes(emoji)) return "coupleFloat";
  return "floatUp";
}

/* ── Explosion particles ── */
function Explosion({ emoji, x, y, onDone }) {
  const particles = getExplosionParticles(emoji);
  const prefersReduce = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches : false;

  useEffect(() => {
    const t = setTimeout(onDone, prefersReduce ? 0 : 700);
    return () => clearTimeout(t);
  }, [onDone, prefersReduce]);

  if (prefersReduce) {
    return (
      <div
        className="pointer-events-none fixed z-[70]"
        style={{ left: x, top: y, fontSize: 32 }}
      >
        ✨
      </div>
    );
  }

  return (
    <>
      {particles.map((p, i) => {
        const angle  = (i / particles.length) * 360;
        const rad    = (angle * Math.PI) / 180;
        const dist   = 50 + Math.random() * 40;
        const tx     = Math.round(Math.cos(rad) * dist);
        const ty     = Math.round(Math.sin(rad) * dist);
        return (
          <div
            key={i}
            className="pointer-events-none fixed z-[70]"
            style={{
              left: x + EMOJI_SIZE / 2,
              top:  y + EMOJI_SIZE / 2,
              fontSize: 24,
              "--tx": `${tx}px`,
              "--ty": `${ty}px`,
              animation: `explodeParticle 0.65s ease-out ${i * 40}ms forwards`,
            }}
          >
            {p}
          </div>
        );
      })}
    </>
  );
}

/* ── Main export ── */
export default function FloatingReactionLayer({ reactions, onReactionClick, isCouple }) {
  const [floating, setFloating]    = useState([]);
  const [explosions, setExplosions] = useState([]);
  const seenRef = useRef(new Set());

  useEffect(() => { injectKeyframes(); }, []);

  // Consume incoming reactions and spawn floating emojis
  useEffect(() => {
    if (!reactions?.length) return;
    reactions.forEach((r) => {
      if (seenRef.current.has(r.id)) return;
      seenRef.current.add(r.id);

      setFloating((prev) => {
        if (prev.length >= MAX_FLOATING) return prev; // cap to avoid clutter
        return [...prev, {
          id:       r.id,
          emoji:    r.emoji,
          mine:     r.mine,
          isCouple: r.isCouple,
          x:        10 + Math.random() * 70, // % from left
          spawnMs:  Date.now(),
        }];
      });

      // Auto-remove after animation completes
      setTimeout(() => {
        setFloating((prev) => prev.filter((f) => f.id !== r.id));
        seenRef.current.delete(r.id);
      }, DURATION_MS + 200);
    });
  }, [reactions]);

  const handleFloatClick = (e, item) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const exId = `ex-${Date.now()}-${Math.random()}`;
    setExplosions((prev) => [...prev, {
      id: exId, emoji: item.emoji, x: rect.left, y: rect.top
    }]);
    onReactionClick?.(item.id, item.emoji);
  };

  const prefersReduce = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches : false;

  return (
    <div
      className="absolute inset-0 z-[34] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {floating.map((item) => {
        const anim = prefersReduce ? "none" : pickAnimation(item.emoji);
        const dur  = prefersReduce ? "0s"  : `${DURATION_MS}ms`;
        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => handleFloatClick(e, item)}
            className="absolute pointer-events-auto cursor-pointer border-0 bg-transparent p-0 select-none"
            style={{
              left:       `${item.x}%`,
              bottom:     "15%",
              fontSize:   `${EMOJI_SIZE}px`,
              lineHeight: 1,
              animation:  `${anim} ${dur} ease-out forwards`,
              filter:     item.isCouple ? "drop-shadow(0 0 6px rgba(239,68,68,0.6))" : undefined,
              willChange: "transform, opacity",
            }}
            aria-label={`Reaction ${item.emoji}`}
          >
            {item.emoji}
          </button>
        );
      })}

      {/* Explosions (outside pointer-events-none boundary) */}
      {explosions.map((ex) => (
        <Explosion
          key={ex.id}
          emoji={ex.emoji}
          x={ex.x}
          y={ex.y}
          onDone={() => setExplosions((prev) => prev.filter((e) => e.id !== ex.id))}
        />
      ))}
    </div>
  );
}
