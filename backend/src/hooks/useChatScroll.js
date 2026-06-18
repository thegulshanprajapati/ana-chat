import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function useChatScroll({
  containerRef,
  bottomRef,
  topThreshold = 64,
  bottomThreshold = 140,
  showTopAfter = 380
} = {}) {
  const rafRef = useRef(0);
  const [metrics, setMetrics] = useState(() => ({
    atTop: true,
    atBottom: true,
    showScrollDown: false,
    showScrollTop: false
  }));

  const compute = useCallback(() => {
    const container = containerRef?.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom <= bottomThreshold;
    const atTop = container.scrollTop <= topThreshold;
    const showScrollDown = !atBottom && container.scrollHeight > container.clientHeight + 160;
    const showScrollTop = !atTop && container.scrollTop >= showTopAfter;

    setMetrics((prev) => {
      if (
        prev.atBottom === atBottom
        && prev.atTop === atTop
        && prev.showScrollDown === showScrollDown
        && prev.showScrollTop === showScrollTop
      ) {
        return prev;
      }
      return { atBottom, atTop, showScrollDown, showScrollTop };
    });
  }, [bottomThreshold, containerRef, showTopAfter, topThreshold]);

  const scheduleCompute = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(compute);
  }, [compute]);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return undefined;

    scheduleCompute();

    function onScroll() {
      scheduleCompute();
    }

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef, scheduleCompute]);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    if (bottomRef?.current?.scrollIntoView) {
      bottomRef.current.scrollIntoView({ behavior, block: "end" });
      return;
    }
    const container = containerRef?.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, [bottomRef, containerRef]);

  const scrollToTop = useCallback((behavior = "smooth") => {
    const container = containerRef?.current;
    if (!container) return;
    container.scrollTo({ top: 0, behavior });
  }, [containerRef]);

  const api = useMemo(() => ({
    ...metrics,
    scrollToBottom,
    scrollToTop,
    refresh: scheduleCompute
  }), [metrics, scheduleCompute, scrollToBottom, scrollToTop]);

  return api;
}

