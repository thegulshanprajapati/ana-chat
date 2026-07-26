import { useEffect, useRef, useState } from "react";

export default function CustomConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  type = "confirm", // "confirm", "alert", or "prompt"
  placeholder = "Enter text",
  isPassword = false,
  defaultValue = "",
  onConfirm,
  onCancel
}) {
  const okButtonRef = useRef(null);
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
      if (type === "prompt") {
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        okButtonRef.current?.focus();
      }
    }
  }, [isOpen, type, defaultValue]);

  if (!isOpen) return null;

  const handleOkClick = () => {
    if (type === "prompt") {
      onConfirm?.(inputValue);
    } else {
      onConfirm?.();
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4" style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--border-color, rgba(255,255,255,0.1))", color: "var(--text-primary)" }}>
        <div>
          <h3 className="text-base font-semibold">
            {title}
          </h3>
          {message && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              {message}
            </p>
          )}
        </div>

        {type === "prompt" && (
          <div className="w-full">
            <input
              ref={inputRef}
              type={isPassword ? "password" : "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleOkClick();
                if (e.key === "Escape") onCancel?.();
              }}
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition focus:ring-1"
              style={{
                borderColor: "var(--border-color, rgba(255,255,255,0.15))",
                color: "var(--text-primary)",
                "--tw-ring-color": "var(--accent)"
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-2">
          {type !== "alert" && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border text-xs font-semibold transition active:scale-[0.98]"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderColor: "var(--border-color, rgba(255,255,255,0.1))",
                color: "var(--text-primary)"
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            ref={type !== "prompt" ? okButtonRef : undefined}
            type="button"
            onClick={handleOkClick}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition active:scale-[0.98]"
            style={{
              backgroundColor: "var(--accent)"
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
