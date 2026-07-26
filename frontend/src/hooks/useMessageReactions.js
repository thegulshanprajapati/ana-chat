import { useCallback, useMemo } from "react";

export const QUICK_REACTIONS = [
  "\u2764\uFE0F", // ❤️
  "\uD83D\uDE02", // 😂
  "\uD83D\uDE2E", // 😮
  "\uD83D\uDE22", // 😢
  "\uD83D\uDC4D" // 👍
];

export default function useMessageReactions(message, onReact) {
  const reactions = useMemo(
    () => Object.entries(message?.reactions || {}).filter(([, count]) => Number(count) > 0),
    [message?.reactions]
  );

  const toggleReaction = useCallback((reaction) => {
    const next = message?.my_reaction === reaction ? "" : reaction;
    onReact?.(message, next);
  }, [message, onReact]);

  return {
    quickReactions: QUICK_REACTIONS,
    reactions,
    toggleReaction
  };
}
