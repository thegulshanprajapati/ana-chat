import { useEffect } from "react";

export default function useDisableDevtools(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    function onContextMenu(event) {
      event.preventDefault();
    }

    function onKeyDown(event) {
      const key = (event.key || "").toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      if (event.key === "F12") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (ctrlOrMeta && shift && ["i", "j", "c", "k"].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.metaKey && alt && ["i", "j", "c"].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (ctrlOrMeta && key === "u") {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled]);
}

