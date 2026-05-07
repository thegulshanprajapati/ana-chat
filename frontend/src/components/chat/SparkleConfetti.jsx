import { useEffect, useMemo } from "react";

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export default function SparkleConfetti({ active, onDone }) {
  const particles = useMemo(() => {
    if (!active) return [];
    const palette = [
      "rgb(var(--accent-200-rgb) / 1)",
      "rgb(var(--accent-300-rgb) / 1)",
      "rgb(var(--accent-400-rgb) / 1)",
      "rgb(var(--accent-500-rgb) / 1)",
      "rgb(var(--accent-600-rgb) / 1)",
      "rgb(var(--accent-700-rgb) / 1)"
    ];
    return Array.from({ length: 18 }).map((_, index) => {
      const color = palette[index % palette.length];
      return {
        id: `${Date.now()}-${index}`,
        left: randomBetween(18, 82),
        top: randomBetween(8, 38),
        dx: randomBetween(-90, 90),
        dy: randomBetween(-40, 70),
        rot: randomBetween(-220, 220),
        size: randomBetween(4, 7),
        delay: randomBetween(0, 120),
        duration: randomBetween(680, 920),
        color
      };
    });
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => onDone?.(), 980);
    return () => clearTimeout(timer);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
      <div className="relative h-16 w-full max-w-[560px]">
        {particles.map((p) => (
          <span
            key={p.id}
            className="chat-sparkle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              "--sx": `${p.dx}px`,
              "--sy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              "--dur": `${p.duration}ms`,
              "--delay": `${p.delay}ms`
            }}
          />
        ))}
      </div>
    </div>
  );
}
