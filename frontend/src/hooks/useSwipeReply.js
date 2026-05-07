import { useCallback, useRef, useState } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function useSwipeReply({
  enabled = true,
  threshold = 72,
  maxOffset = 96,
  onReply
} = {}) {
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    active: false,
    swiping: false
  });
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const reset = useCallback(() => {
    stateRef.current.active = false;
    stateRef.current.swiping = false;
    setSwiping(false);
    setOffset(0);
  }, []);

  const onTouchStart = useCallback((event) => {
    if (!enabled) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    stateRef.current.startX = touch.clientX;
    stateRef.current.startY = touch.clientY;
    stateRef.current.active = true;
    stateRef.current.swiping = false;
    setSwiping(false);
    setOffset(0);
  }, [enabled]);

  const onTouchMove = useCallback((event) => {
    if (!enabled) return;
    if (!stateRef.current.active) return;
    const touch = event.touches?.[0];
    if (!touch) return;

    const dx = touch.clientX - stateRef.current.startX;
    const dy = touch.clientY - stateRef.current.startY;

    // Only activate swipe-to-reply when the user is intentionally swiping horizontally.
    if (!stateRef.current.swiping) {
      if (dx <= 12) return;
      if (Math.abs(dx) <= Math.abs(dy) + 8) return;
      stateRef.current.swiping = true;
      setSwiping(true);
    }

    if (dx <= 0) {
      setOffset(0);
      return;
    }
    setOffset(clamp(dx, 0, maxOffset));
  }, [enabled, maxOffset]);

  const onTouchEnd = useCallback(() => {
    if (!enabled) return false;
    if (!stateRef.current.active) return false;

    const wasSwiping = stateRef.current.swiping;
    const shouldTrigger = wasSwiping && offset >= threshold;
    reset();
    if (shouldTrigger) {
      onReply?.();
      return true;
    }
    return wasSwiping;
  }, [enabled, offset, onReply, reset, threshold]);

  return {
    offset,
    swiping,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    reset
  };
}

