export default function ChatListSkeleton() {
  return (
    <div className="space-y-2 px-3 py-2" aria-hidden>
      {Array.from({ length: 7 }).map((_, idx) => (
        <div key={idx} className="animate-pulse rounded-2xl border border-slate-200/70 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-2.5 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
