import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function AdminPanel({ users: initialUsers, onReload }) {
  const [users, setUsers] = useState(initialUsers || []);

  useEffect(() => {
    setUsers(initialUsers || []);
  }, [initialUsers]);

  async function remove(id) {
    await api.delete(`/users/${id}`);
    setUsers((u) => u.filter((x) => x.id !== id));
    onReload?.();
  }

  return (
    <div className="p-6 space-y-3 overflow-y-auto">
      <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">Admin Panel</div>
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 dark:border-neutral-800 dark:bg-black dark:divide-neutral-800">
        {users.map((u) => (
          <div key={u.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">{u.name}</div>
              <div className="text-sm text-slate-500 dark:text-neutral-400">{u.email}</div>
            </div>
            <button
              onClick={() => remove(u.id)}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Delete
            </button>
          </div>
        ))}
        {!users.length && (
          <div className="p-4 text-slate-500 dark:text-neutral-500">No users.</div>
        )}
      </div>
    </div>
  );
}
