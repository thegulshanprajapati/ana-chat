export default function DaySeparator({ label }) {
  return (
    <div className="my-4 flex items-center justify-center">
      <span className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white/65">
        {label}
      </span>
    </div>
  );
}
