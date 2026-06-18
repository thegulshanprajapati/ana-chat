import { CheckCheck } from "lucide-react";
import ReactionBar from "../components/chat/ReactionBar";

export default function ReactionMockup() {
  return (
    <div
      className="thread-surface relative min-h-[100dvh] w-full overflow-hidden"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="pointer-events-none absolute inset-0 chat-noise opacity-[0.08] dark:opacity-[0.10]" aria-hidden />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1100px] items-center justify-center px-6 py-10">
        <div className="relative w-full max-w-[520px]">
          <div className="pointer-events-none absolute -inset-x-12 -top-14 -bottom-10 opacity-40 blur-3xl">
            <div className="h-full w-full rounded-[48px] bg-accent-soft" />
          </div>

          <div className="pointer-events-auto absolute -top-14 right-0 z-20">
            <ReactionBar />
          </div>

          <div className="flex justify-end">
            <div className="relative max-w-[86%] sm:max-w-[70%]">
              <span
                aria-hidden
                className="absolute bottom-2.5 -right-[6px] h-4 w-4 rotate-45 rounded-[4px] border border-white/10 bg-[linear-gradient(135deg,rgb(var(--accent-700-rgb)_/_1),rgb(var(--accent-400-rgb)_/_1))] shadow-[0_18px_52px_rgb(var(--accent-500-rgb)_/_0.28)]"
              />

              <div className="relative overflow-hidden rounded-[22px] border border-white/10 px-3.5 py-2.5 text-white shadow-[0_18px_52px_rgb(var(--accent-500-rgb)_/_0.30)] bg-[radial-gradient(120%_120%_at_15%_0%,rgba(236,72,153,0.22)_0%,transparent_60%),linear-gradient(135deg,rgb(var(--accent-700-rgb)_/_1),rgb(var(--accent-400-rgb)_/_1))]">
                <p className="text-[14px] leading-5">hello</p>
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/85">
                  <span>09:51 PM</span>
                  <CheckCheck size={12} className="text-violet-200" aria-label="Seen" />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600 dark:text-white/60">
            Open at <span className="font-semibold">/mockups/reaction</span> for a clean screenshot.
          </p>
        </div>
      </div>
    </div>
  );
}

