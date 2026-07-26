import { useEffect, useMemo, useState } from "react";
import { Search, UsersRound, X } from "lucide-react";
import Avatar from "./Avatar";

export default function CreateGroupModal({
  open,
  users = [],
  loading = false,
  creating = false,
  onClose,
  onCreate
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (!open) return;
    setName("");
    setQuery("");
    setSelected({});
  }, [open]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => (
      (user.name || "").toLowerCase().includes(q)
      || (user.email || "").toLowerCase().includes(q)
      || (user.mobile || "").toLowerCase().includes(q)
    ));
  }, [query, users]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]).map(Number),
    [selected]
  );

  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || selectedIds.length < 1) return;
    await onCreate?.({
      name: name.trim(),
      memberIds: selectedIds
    });
  }

  function toggleUser(userId) {
    setSelected((prev) => ({ ...prev, [userId]: !prev[userId] }));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55"
        aria-label="Close create group modal"
      />

      <form
        onSubmit={submit}
        className="relative z-10 flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <UsersRound size={18} />
            Create group
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Group name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-500"
              placeholder="Team Alpha"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Add participants
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <Search size={14} className="text-slate-500 dark:text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Search by name/email/mobile"
              />
            </div>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading users...</p>
          ) : !list.length ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No users found.</p>
          ) : (
            <div className="space-y-1.5 pb-2">
              {list.map((user) => {
                const checked = Boolean(selected[user.id]);
                return (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      checked
                        ? "border-violet-400 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={user.name} src={user.avatar_url} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{user.mobile || user.email}</span>
                      </span>
                    </span>
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold ${
                        checked
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500"
                      }`}
                    >
                      {checked ? "OK" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <button
            type="submit"
            disabled={creating || !name.trim() || selectedIds.length < 1}
            className="inline-flex w-full items-center justify-center rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating..." : `Create group (${selectedIds.length} selected)`}
          </button>
        </div>
      </form>
    </div>
  );
}
