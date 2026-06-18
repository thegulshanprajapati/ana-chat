import { Search } from "lucide-react";

export default function ChatSearch({ value, onChange, placeholder = "Search chats or users" }) {
  return (
    <label className="relative block px-4 py-3">
      <Search
        size={16}
        className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-violet-500"
        aria-label="Search chats"
      />
    </label>
  );
}
