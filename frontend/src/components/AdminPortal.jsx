import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ClipboardList,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Shield,
  Ticket,
  User,
  Users,
  X
} from "lucide-react";
import { api } from "../api/client";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: Shield },
  { id: "users", label: "Users", icon: Users },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "userActivity", label: "User Activity", icon: Activity },
  { id: "audit", label: "Audit Logs", icon: ClipboardList },
  { id: "admins", label: "Admins", icon: User }
];

const pageBgClass = "min-h-screen bg-black text-neutral-100";
const panelClass = "rounded-lg border border-neutral-800 bg-neutral-950 shadow-lg";
const inputClass = "w-full rounded-lg border border-neutral-800 bg-black/70 px-3 py-2 text-[13px] text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";
const subtleBtnClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-black/70 px-3.5 py-2 text-[13px] font-semibold text-neutral-100 transition hover:border-neutral-600 hover:bg-neutral-900/60 disabled:cursor-not-allowed disabled:opacity-60";
const cyanBtnClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-violet-500/55 bg-violet-500/20 px-3.5 py-2 text-[13px] font-semibold text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60";
const dangerBtnClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/45 bg-rose-500/15 px-3.5 py-2 text-[13px] font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60";
const dashboardHistoryLimit = 36;
const dashboardPollIntervalMs = 5000;

function normalizeMetric(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function normalizeDashboardPayload(payload = {}) {
  return {
    totalUsers: normalizeMetric(payload.totalUsers),
    onlineUsers: normalizeMetric(payload.onlineUsers),
    totalMessages: normalizeMetric(payload.totalMessages)
  };
}

function appendDashboardSnapshot(history, snapshot) {
  const now = Date.now();
  const nextPoint = {
    timestamp: now,
    totalUsers: normalizeMetric(snapshot.totalUsers),
    onlineUsers: normalizeMetric(snapshot.onlineUsers),
    totalMessages: normalizeMetric(snapshot.totalMessages)
  };

  const nextHistory = [...history, nextPoint];
  if (nextHistory.length <= dashboardHistoryLimit) return nextHistory;
  return nextHistory.slice(nextHistory.length - dashboardHistoryLimit);
}

function formatLiveTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function userStatusMeta(user) {
  if (user.is_blocked) {
    return {
      label: "Blocked",
      badgeClass: "border-rose-500/50 bg-rose-500/20 text-rose-200",
      dotClass: "bg-rose-400"
    };
  }

  const isOnline = Boolean(user.live_online || user.status === "online");
  if (isOnline) {
    return {
      label: "Online",
      badgeClass: "border-emerald-500/45 bg-emerald-500/15 text-emerald-200",
      dotClass: "bg-emerald-400"
    };
  }

  return {
    label: "Offline",
    badgeClass: "border-slate-500/50 bg-slate-700/45 text-slate-200",
    dotClass: "bg-slate-400"
  };
}

function adminRoleMeta(role) {
  const isSuperAdmin = role === "super_admin";
  return {
    label: isSuperAdmin ? "Super Admin" : "Admin",
    badgeClass: isSuperAdmin
      ? "border-violet-400/70 bg-violet-500/15 text-violet-100"
      : "border-slate-500/70 bg-slate-700/65 text-slate-200"
  };
}

const userActivityTypeOptions = [
  { value: "all", label: "All actions" },
  { value: "PROFILE_UPDATE", label: "Profile update" },
  { value: "SETTINGS_UPDATE", label: "Settings update" },
  { value: "BLOCK_USER", label: "Block user" },
  { value: "UNBLOCK_USER", label: "Unblock user" },
  { value: "REPORT_USER", label: "Report user" }
];

function activityTypeMeta(type) {
  const normalized = (type || "").toString().toUpperCase();
  if (normalized === "PROFILE_UPDATE") {
    return {
      label: "Profile update",
      badgeClass: "border-violet-500/55 bg-violet-500/15 text-violet-100"
    };
  }
  if (normalized === "SETTINGS_UPDATE") {
    return {
      label: "Settings update",
      badgeClass: "border-indigo-500/55 bg-indigo-500/15 text-indigo-100"
    };
  }
  if (normalized === "BLOCK_USER") {
    return {
      label: "Block user",
      badgeClass: "border-rose-500/55 bg-rose-500/15 text-rose-200"
    };
  }
  if (normalized === "UNBLOCK_USER") {
    return {
      label: "Unblock user",
      badgeClass: "border-emerald-500/55 bg-emerald-500/15 text-emerald-200"
    };
  }
  if (normalized === "REPORT_USER") {
    return {
      label: "Report user",
      badgeClass: "border-amber-500/55 bg-amber-500/15 text-amber-200"
    };
  }
  return {
    label: normalized || "Unknown",
    badgeClass: "border-slate-500/55 bg-slate-700/55 text-slate-200"
  };
}

function activityPerson(row, key) {
  const name = row?.[`${key}_name`] || "";
  const email = row?.[`${key}_email`] || "";
  const mobile = row?.[`${key}_mobile`] || "";
  const primary = name || email || mobile || "-";
  const secondary = [email, mobile].filter(Boolean).join(" | ");
  return { primary, secondary };
}

function activityDetails(log) {
  const metadata = log?.metadata_json && typeof log.metadata_json === "object"
    ? log.metadata_json
    : {};
  const type = (log?.activity_type || "").toString().toUpperCase();

  if (type === "REPORT_USER") {
    const reason = (metadata.reason || "").toString().replace(/_/g, " ");
    const details = (metadata.details || "").toString().trim();
    if (reason && details) return `${reason}: ${details}`;
    if (reason) return reason;
    if (details) return details;
    return "Report submitted";
  }

  if (type === "PROFILE_UPDATE") {
    const fields = Array.isArray(metadata.changed_fields) ? metadata.changed_fields : [];
    if (!fields.length) return "Profile changed";
    return `Changed: ${fields.join(", ")}`;
  }

  if (type === "SETTINGS_UPDATE") {
    const keys = Array.isArray(metadata.changed_settings) ? metadata.changed_settings : [];
    if (!keys.length) return "Settings changed";
    return `Settings: ${keys.join(", ")}`;
  }

  if (!metadata || Object.keys(metadata).length === 0) return "-";
  try {
    return JSON.stringify(metadata);
  } catch {
    return "-";
  }
}

export default function AdminPortal() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [loadingTab, setLoadingTab] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dashboard, setDashboard] = useState({ totalUsers: 0, onlineUsers: 0, totalMessages: 0 });
  const [dashboardHistory, setDashboardHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [userActivityLogs, setUserActivityLogs] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [busyUserId, setBusyUserId] = useState(null);
  const [busyAdminId, setBusyAdminId] = useState(null);
  const [adminForm, setAdminForm] = useState({
    id: null,
    name: "",
    username: "",
    password: "",
    role: "admin"
  });

  const [searchUsers, setSearchUsers] = useState("");
  const [searchChats, setSearchChats] = useState("");
  const [searchMessages, setSearchMessages] = useState("");
  const [searchUserActivity, setSearchUserActivity] = useState("");
  const [userActivityType, setUserActivityType] = useState("all");

  const activeTab = useMemo(() => tabs.find((item) => item.id === tab) || tabs[0], [tab]);
  const onlineUsersFromRows = useMemo(
    () => users.filter((u) => !u.is_blocked && (u.live_online || u.status === "online")).length,
    [users]
  );
  const isSuperAdmin = admin?.role === "super_admin";

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/me");
        setAdmin(data);
      } catch {
        setAdmin(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (checking || admin) return;
    window.location.replace("/");
  }, [checking, admin]);

  useEffect(() => {
    if (!admin) return;
    void loadTabData(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, tab]);

  useEffect(() => {
    if (!admin) return undefined;
    if (tab !== "dashboard" && tab !== "users") return undefined;
    const timer = setInterval(() => {
      void loadTabData(tab, { silent: true });
    }, dashboardPollIntervalMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, tab, searchUsers]);

  async function loadTabData(targetTab = tab, options = {}) {
    const { silent = false } = options;
    if (!silent) setLoadingTab(true);
    setError("");

    try {
      if (targetTab === "dashboard") {
        const { data } = await api.get("/admin/dashboard");
        const normalized = normalizeDashboardPayload(data);
        setDashboard(normalized);
        setDashboardHistory((prev) => appendDashboardSnapshot(prev, normalized));
      } else if (targetTab === "users") {
        const { data } = await api.get("/admin/users", { params: { q: searchUsers.trim() } });
        setUsers(Array.isArray(data) ? data : []);
      } else if (targetTab === "chats") {
        const { data } = await api.get("/admin/chats", { params: { q: searchChats.trim() } });
        setChats(Array.isArray(data) ? data : []);
      } else if (targetTab === "audit") {
        const { data } = await api.get("/admin/audit-logs");
        setAuditLogs(Array.isArray(data) ? data : []);
      } else if (targetTab === "userActivity") {
        const { data } = await api.get("/admin/user-activity", {
          params: {
            q: searchUserActivity.trim(),
            type: userActivityType,
            limit: 500
          }
        });
        setUserActivityLogs(Array.isArray(data) ? data : []);
      } else if (targetTab === "admins") {
        const { data } = await api.get("/admin/admins");
        setAdmins(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load admin data");
    } finally {
      if (!silent) setLoadingTab(false);
    }
  }

  async function handleAdminLogout() {
    try {
      await api.post("/admin/logout");
    } catch {
      // no-op
    }
    setAdmin(null);
  }

  async function withUserAction(userId, requestFn, successMessage) {
    setBusyUserId(userId);
    setError("");
    setNotice("");

    try {
      await requestFn();
      setNotice(successMessage);
      await loadTabData("users", { silent: true });
      await loadTabData("dashboard", { silent: true });
    } catch (err) {
      setError(err.response?.data?.message || "Action failed");
    } finally {
      setBusyUserId(null);
    }
  }
  async function blockUser(userId) {
    await withUserAction(userId, () => api.patch(`/admin/users/${userId}/block`), "User blocked successfully");
  }

  async function unblockUser(userId) {
    await withUserAction(userId, () => api.patch(`/admin/users/${userId}/unblock`), "User unblocked successfully");
  }

  async function forceLogoutUser(userId) {
    await withUserAction(userId, () => api.post(`/admin/users/${userId}/force-logout`), "User logged out from all sessions");
  }

  async function deleteUser(user) {
    const ok = window.confirm(`Delete user "${user.name}" permanently?`);
    if (!ok) return;
    await withUserAction(user.id, () => api.delete(`/admin/users/${user.id}`), "User deleted permanently");
  }

  async function openChat(chat) {
    setSelectedChat(chat);
    setError("");

    try {
      const { data } = await api.get(`/admin/chats/${chat.id}/messages`, {
        params: { q: searchMessages.trim() }
      });
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load chat messages");
    }
  }

  async function searchInChatMessages(e) {
    e.preventDefault();
    if (!selectedChat) return;
    setError("");

    try {
      const { data } = await api.get(`/admin/chats/${selectedChat.id}/messages`, {
        params: { q: searchMessages.trim() }
      });
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to search messages");
    }
  }

  function resetAdminForm() {
    setAdminForm({
      id: null,
      name: "",
      username: "",
      password: "",
      role: "admin"
    });
  }

  function startEditAdmin(item) {
    setAdminForm({
      id: item.id,
      name: item.name || "",
      username: item.username || "",
      password: "",
      role: item.role === "super_admin" ? "super_admin" : "admin"
    });
  }

  async function saveAdmin(e) {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setError("");
    setNotice("");
    setBusyAdminId(adminForm.id || -1);

    const payload = {
      name: adminForm.name.trim(),
      username: adminForm.username.trim(),
      role: adminForm.role
    };
    if (adminForm.password.trim()) {
      payload.password = adminForm.password;
    }

    try {
      if (adminForm.id) {
        const { data } = await api.patch(`/admin/admins/${adminForm.id}`, payload);
        setNotice(`Admin updated: ${data?.admin?.username || payload.username}`);
      } else {
        const { data } = await api.post("/admin/admins", payload);
        setNotice(`Admin created: ${data?.admin?.username || payload.username}`);
      }
      resetAdminForm();
      await loadTabData("admins", { silent: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save admin");
    } finally {
      setBusyAdminId(null);
    }
  }

  async function deleteAdmin(item) {
    if (!isSuperAdmin) return;
    const ok = window.confirm(`Delete admin "${item.username}"?`);
    if (!ok) return;
    setError("");
    setNotice("");
    setBusyAdminId(item.id);
    try {
      await api.delete(`/admin/admins/${item.id}`);
      setNotice(`Admin deleted: ${item.username}`);
      if (adminForm.id === item.id) {
        resetAdminForm();
      }
      await loadTabData("admins", { silent: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete admin");
    } finally {
      setBusyAdminId(null);
    }
  }

  function renderDashboard() {
    const latestSnapshot = dashboardHistory[dashboardHistory.length - 1];
    const previousSnapshot = dashboardHistory[dashboardHistory.length - 2];
    const messageDelta = latestSnapshot && previousSnapshot
      ? latestSnapshot.totalMessages - previousSnapshot.totalMessages
      : 0;
    const onlineRatio = dashboard.totalUsers > 0
      ? Math.round((dashboard.onlineUsers / dashboard.totalUsers) * 100)
      : 0;

    return (
      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard title="Total users" value={dashboard.totalUsers} subtitle="All time" />
          <MetricCard title="Online users" value={dashboard.onlineUsers} subtitle="Live now" />
          <MetricCard title="Total messages" value={dashboard.totalMessages} subtitle="All time" />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <LiveTrendCard
            title="Online users trend"
            value={dashboard.onlineUsers}
            points={dashboardHistory}
            dataKey="onlineUsers"
            color="rgb(var(--accent-400-rgb) / 1)"
            footerLabel={`Online ratio: ${onlineRatio}%`}
          />
          <LiveTrendCard
            title="Users growth"
            value={dashboard.totalUsers}
            points={dashboardHistory}
            dataKey="totalUsers"
            color="rgb(var(--accent-300-rgb) / 1)"
            footerLabel="Registered users over time"
          />
          <LiveTrendCard
            title="Messages velocity"
            value={dashboard.totalMessages}
            points={dashboardHistory}
            dataKey="totalMessages"
            color="rgb(var(--accent-500-rgb) / 1)"
            footerLabel={messageDelta > 0 ? `+${messageDelta} since last update` : "No new messages in last update"}
          />
        </div>

        <p className="text-xs text-slate-400">
          Live updates every {Math.round(dashboardPollIntervalMs / 1000)}s. Last refresh: {formatLiveTime(latestSnapshot?.timestamp)}.
        </p>
      </section>
    );
  }

  function renderUsers() {
    return (
      <section className={`${panelClass} p-3.5 md:p-4 space-y-3`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadTabData("users");
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={searchUsers}
            onChange={(e) => setSearchUsers(e.target.value)}
            className={inputClass}
            placeholder="Search users by name, email or mobile"
          />
          <button type="submit" className={subtleBtnClass}>Search</button>
        </form>

        <p className="text-xs text-slate-400">Live online in list: {onlineUsersFromRows}</p>

        <div className="hidden xl:block overflow-x-auto rounded-2xl border border-slate-700/70">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="p-3 text-left font-semibold">Name</th>
                <th className="p-3 text-left font-semibold">Email</th>
                <th className="p-3 text-left font-semibold">Mobile</th>
                <th className="p-3 text-left font-semibold">Status</th>
                <th className="p-3 text-left font-semibold">Last seen</th>
                <th className="p-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const meta = userStatusMeta(u);
                const busy = busyUserId === u.id;
                return (
                  <tr key={u.id} className="border-t border-slate-800/80 text-slate-200">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3 text-slate-300">{u.email}</td>
                    <td className="p-3 text-slate-300">{u.mobile || "-"}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                        <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{formatDateTime(u.last_seen)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.is_blocked ? (
                          <button onClick={() => unblockUser(u.id)} disabled={busy} className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200 disabled:opacity-60">Unblock</button>
                        ) : (
                          <button onClick={() => blockUser(u.id)} disabled={busy} className="rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-200 disabled:opacity-60">Block</button>
                        )}
                        <button onClick={() => forceLogoutUser(u.id)} disabled={busy} className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-200 disabled:opacity-60">Force logout</button>
                        <button onClick={() => deleteUser(u)} disabled={busy} className="rounded-md border border-red-500/50 bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-200 disabled:opacity-60">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 xl:hidden">
          {users.map((u) => {
            const meta = userStatusMeta(u);
            const busy = busyUserId === u.id;
            return (
              <article key={u.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{u.name}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                    <p className="truncate text-xs text-slate-500">{u.mobile || "-"}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${meta.badgeClass}`}>
                    <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                    {meta.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Last seen: {formatDateTime(u.last_seen)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {u.is_blocked ? (
                    <button onClick={() => unblockUser(u.id)} disabled={busy} className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-60">Unblock</button>
                  ) : (
                    <button onClick={() => blockUser(u.id)} disabled={busy} className="rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-1.5 text-xs font-semibold text-rose-200 disabled:opacity-60">Block</button>
                  )}
                  <button onClick={() => forceLogoutUser(u.id)} disabled={busy} className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 text-xs font-semibold text-amber-200 disabled:opacity-60">Force logout</button>
                  <button onClick={() => deleteUser(u)} disabled={busy} className="col-span-2 rounded-md border border-red-500/50 bg-red-500/15 px-2 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-60">Delete user</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderChats() {
    return (
      <section className="grid gap-3 xl:grid-cols-12">
        <div className={`${panelClass} p-3.5 md:p-4 space-y-2.5 xl:col-span-5`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadTabData("chats");
            }}
            className="flex gap-2"
          >
            <input value={searchChats} onChange={(e) => setSearchChats(e.target.value)} className={inputClass} placeholder="Search chat by participant" />
            <button type="submit" className={subtleBtnClass}>Search</button>
          </form>

          <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => openChat(chat)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selectedChat?.id === chat.id
                      ? "border-violet-500/70 bg-violet-500/15"
                      : "border-slate-700 bg-slate-900/60 hover:bg-slate-800/70"
                  }`}
                >
                <p className="font-semibold text-slate-100">{chat.user1_name} - {chat.user2_name}</p>
                <p className="text-xs text-slate-500">Chat #{chat.id}</p>
              </button>
            ))}
            {chats.length === 0 && <p className="text-sm text-slate-500">No chats found.</p>}
          </div>
        </div>

        <div className={`${panelClass} p-3.5 md:p-4 space-y-2.5 xl:col-span-7`}>
          <form onSubmit={searchInChatMessages} className="flex gap-2">
            <input
              value={searchMessages}
              onChange={(e) => setSearchMessages(e.target.value)}
              className={inputClass}
              placeholder="Search messages"
              disabled={!selectedChat}
            />
            <button type="submit" disabled={!selectedChat} className={subtleBtnClass}>Search</button>
          </form>

          <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
            {!selectedChat && <p className="text-sm text-slate-500">Select a chat to inspect messages.</p>}
            {chatMessages.map((m) => (
              <article key={m.id} className="rounded-2xl border border-slate-700 bg-slate-900/65 p-3">
                <p className="text-xs text-slate-500">{m.sender_name} - {formatDateTime(m.created_at)}</p>
                <p className="mt-1 text-sm text-slate-200">{m.body || (m.image_url ? `[image] ${m.image_url}` : "-")}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderUserActivity() {
    return (
      <section className={`${panelClass} p-3.5 md:p-4 space-y-3`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadTabData("userActivity");
          }}
          className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_180px_100px]"
        >
          <input
            value={searchUserActivity}
            onChange={(e) => setSearchUserActivity(e.target.value)}
            className={inputClass}
            placeholder="Search actor/target by name, email or mobile"
          />
          <select
            value={userActivityType}
            onChange={(e) => setUserActivityType(e.target.value)}
            className={inputClass}
          >
            {userActivityTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="submit" className={subtleBtnClass}>Apply</button>
        </form>

        <p className="text-xs text-slate-400">Recent activity logs: {userActivityLogs.length}</p>

        <div className="hidden overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/45 xl:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead className="bg-slate-900/85 text-slate-300">
                <tr className="border-b border-slate-700/80">
                  <th className="p-2.5 text-left font-semibold">Time</th>
                  <th className="p-2.5 text-left font-semibold">Action</th>
                  <th className="p-2.5 text-left font-semibold">Actor</th>
                  <th className="p-2.5 text-left font-semibold">Target</th>
                  <th className="p-2.5 text-left font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {userActivityLogs.map((log) => {
                  const typeMeta = activityTypeMeta(log.activity_type);
                  const actor = activityPerson(log, "actor");
                  const target = activityPerson(log, "target");
                  return (
                    <tr key={log.id} className="border-b border-slate-800/80 text-slate-200">
                      <td className="p-2.5 whitespace-nowrap text-xs text-slate-400">{formatDateTime(log.created_at)}</td>
                      <td className="p-2.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeMeta.badgeClass}`}>
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="p-2.5 align-top">
                        <p className="font-medium text-slate-100">{actor.primary}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{actor.secondary || "-"}</p>
                      </td>
                      <td className="p-2.5 align-top">
                        <p className="font-medium text-slate-100">{target.primary}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{target.secondary || "-"}</p>
                      </td>
                      <td className="max-w-[340px] p-2.5 align-top text-[11px] leading-4 text-slate-300 break-words whitespace-normal">
                        {activityDetails(log)}
                      </td>
                    </tr>
                  );
                })}
                {!userActivityLogs.length && (
                  <tr>
                    <td colSpan={5} className="p-5 text-center text-slate-500">No activity logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 xl:hidden">
          {userActivityLogs.map((log) => {
            const typeMeta = activityTypeMeta(log.activity_type);
            const actor = activityPerson(log, "actor");
            const target = activityPerson(log, "target");
            return (
              <article key={log.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeMeta.badgeClass}`}>
                    {typeMeta.label}
                  </span>
                  <span className="text-[11px] text-slate-500">{formatDateTime(log.created_at)}</span>
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-slate-300">
                    <span className="text-slate-500">Actor:</span> {actor.primary}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Target:</span> {target.primary}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Details:</span> {activityDetails(log)}
                  </p>
                </div>
              </article>
            );
          })}
          {!userActivityLogs.length && (
            <p className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-4 text-center text-sm text-slate-500">
              No activity logs found.
            </p>
          )}
        </div>
      </section>
    );
  }

  function renderAudit() {
    return (
      <section className={`${panelClass} p-3.5 md:p-4`}>
        <div className="overflow-x-auto rounded-2xl border border-slate-700/70">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Admin</th>
                <th className="p-3 text-left">Action</th>
                <th className="p-3 text-left">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-800/80">
                  <td className="p-3 text-slate-400">{formatDateTime(log.created_at)}</td>
                  <td className="p-3 text-slate-300">{log.admin_email || "-"}</td>
                  <td className="p-3 text-slate-200">{log.action}</td>
                  <td className="p-3 text-xs font-mono text-slate-400">{typeof log.metadata === "string" ? log.metadata : JSON.stringify(log.metadata)}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">No audit logs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderAdmins() {
    return (
      <section className="grid gap-3 xl:grid-cols-5">
        <article className={`${panelClass} p-3.5 md:p-4 xl:col-span-2`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {adminForm.id ? "Modify admin" : "Add admin"}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-100">
            {adminForm.id ? "Update Admin Details" : "Create New Admin"}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {isSuperAdmin
              ? "Super admin can create, edit and delete all admins."
              : "Only super admin can modify admin accounts."}
          </p>

          <form onSubmit={saveAdmin} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin name</span>
              <input
                required
                className={inputClass}
                placeholder="Admin name"
                value={adminForm.name}
                onChange={(e) => setAdminForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={!isSuperAdmin || busyAdminId !== null}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Username</span>
              <input
                required
                className={inputClass}
                placeholder="admin_username"
                value={adminForm.username}
                onChange={(e) => setAdminForm((prev) => ({ ...prev, username: e.target.value.toLowerCase() }))}
                disabled={!isSuperAdmin || busyAdminId !== null}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {adminForm.id ? "Password (optional)" : "Password"}
              </span>
              <input
                type="password"
                minLength={6}
                className={inputClass}
                placeholder={adminForm.id ? "Leave blank to keep current password" : "Minimum 6 characters"}
                value={adminForm.password}
                onChange={(e) => setAdminForm((prev) => ({ ...prev, password: e.target.value }))}
                disabled={!isSuperAdmin || busyAdminId !== null}
                required={!adminForm.id}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Role</span>
              <select
                className={inputClass}
                value={adminForm.role}
                onChange={(e) => setAdminForm((prev) => ({ ...prev, role: e.target.value }))}
                disabled={!isSuperAdmin || busyAdminId !== null}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className={cyanBtnClass}
                disabled={!isSuperAdmin || busyAdminId !== null}
              >
                {adminForm.id ? "Update admin" : "Add admin"}
              </button>
              {adminForm.id && (
                <button
                  type="button"
                  className={subtleBtnClass}
                  onClick={resetAdminForm}
                  disabled={!isSuperAdmin || busyAdminId !== null}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </article>

        <article className={`${panelClass} p-3.5 md:p-4 xl:col-span-3`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Admin list</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-100">{admins.length} Admins</h3>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    isSuperAdmin
                      ? "border-violet-500/55 bg-violet-500/15 text-violet-100"
                      : "border-amber-500/45 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {isSuperAdmin ? "Super admin access" : "Read-only access"}
                </span>
              </div>
            </div>
            <button type="button" onClick={() => void loadTabData("admins")} className={subtleBtnClass}>
              <RefreshCw size={16} />
              Reload
            </button>
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/45 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead className="bg-slate-900/85 text-slate-300">
                  <tr className="border-b border-slate-700/80">
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Name</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Username</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Role</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Email</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Created</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((item, index) => {
                    const roleMeta = adminRoleMeta(item.role);
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-800/80 transition hover:bg-slate-800/35 ${
                          index % 2 === 0 ? "bg-slate-900/20" : ""
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-100">{item.name || "-"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-medium text-violet-200">@{item.username}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${roleMeta.badgeClass}`}>
                            {roleMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">{item.email}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-400">{formatDateTime(item.created_at)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditAdmin(item)}
                              disabled={!isSuperAdmin || busyAdminId !== null}
                              className="rounded-lg border border-violet-500/55 bg-violet-500/15 px-2.5 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAdmin(item)}
                              disabled={!isSuperAdmin || busyAdminId !== null || item.id === admin.id}
                              className="rounded-lg border border-rose-500/45 bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!admins.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No admins found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 md:hidden">
            {admins.map((item) => {
              const roleMeta = adminRoleMeta(item.role);
              return (
                <article key={item.id} className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-3.5 shadow-[0_14px_26px_-20px_rgb(0_0_0_/_0.95)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-100">{item.name || "-"}</p>
                      <p className="truncate text-xs text-violet-300">@{item.username}</p>
                    </div>
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${roleMeta.badgeClass}`}>
                      {roleMeta.label}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1">
                    <p className="truncate text-xs text-slate-400">{item.email}</p>
                    <p className="text-[11px] text-slate-500">Created: {formatDateTime(item.created_at)}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => startEditAdmin(item)}
                      disabled={!isSuperAdmin || busyAdminId !== null}
                      className="rounded-lg border border-violet-500/55 bg-violet-500/15 px-2 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAdmin(item)}
                      disabled={!isSuperAdmin || busyAdminId !== null || item.id === admin.id}
                      className="rounded-lg border border-rose-500/45 bg-rose-500/15 px-2 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
            {!admins.length && (
              <p className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-4 text-center text-sm text-slate-500">
                No admins found.
              </p>
            )}
          </div>
        </article>
      </section>
    );
  }

  function renderCurrentSection() {
    if (tab === "users") return renderUsers();
    if (tab === "chats") return renderChats();
    if (tab === "userActivity") return renderUserActivity();
    if (tab === "audit") return renderAudit();
    if (tab === "admins") return renderAdmins();
    return renderDashboard();
  }

  if (checking) {
    return (
      <div className={`${pageBgClass} flex items-center justify-center`}>
        <p className="text-sm text-slate-300">Checking admin session...</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className={`${pageBgClass} flex items-center justify-center px-4 py-10`}>
        <p className="text-sm text-slate-300">Redirecting to secure login...</p>
      </div>
    );
  }

  return (
    <div className={pageBgClass}>
      <div className="mx-auto max-w-[1560px] p-2.5 md:p-4">
        <div className="mb-2.5 flex items-center justify-between lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className={subtleBtnClass}>
            <Menu size={16} />
            Menu
          </button>
          <button onClick={() => void loadTabData(tab)} className={subtleBtnClass} disabled={loadingTab}>
            <RefreshCw size={16} className={loadingTab ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[290px,1fr]">
          <aside className="hidden lg:block">
            <Sidebar
              admin={admin}
              tab={tab}
              onTabChange={(nextTab) => {
                setTab(nextTab);
                setNotice("");
              }}
              onLogout={handleAdminLogout}
            />
          </aside>

          {sidebarOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 lg:hidden">
              <Sidebar
                admin={admin}
                tab={tab}
                mobile
                onClose={() => setSidebarOpen(false)}
                onTabChange={(nextTab) => {
                  setTab(nextTab);
                  setNotice("");
                  setSidebarOpen(false);
                }}
                onLogout={handleAdminLogout}
              />
            </div>
          )}

          <main className="space-y-3">
            <header className={`${panelClass} flex flex-col gap-2.5 p-3.5 md:flex-row md:items-center md:justify-between md:p-4`}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Admin</p>
                <h2 className="text-2xl font-semibold text-slate-50">{activeTab.label}</h2>
              </div>
              <button onClick={() => void loadTabData(tab)} className={subtleBtnClass} disabled={loadingTab}>
                <RefreshCw size={16} className={loadingTab ? "animate-spin" : ""} />
                Refresh
              </button>
            </header>

            {notice && <p className="rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{notice}</p>}
            {error && <p className="rounded-xl border border-rose-500/45 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}

            {renderCurrentSection()}
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ admin, tab, onTabChange, onLogout, onClose, mobile = false }) {
  return (
    <div className={`${panelClass} ${mobile ? "h-full max-h-[100dvh] w-full max-w-[300px] p-3.5" : "sticky top-4 h-[calc(100dvh-2rem)] p-3.5"} flex flex-col`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">AnaChat Console</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-100">Admin</p>
          <p className="mt-1 text-[13px] text-slate-200">{admin.name || admin.username || admin.email}</p>
          <p className="mt-0.5 text-xs text-slate-500">{admin.email}</p>
          <p className="mt-0.5 text-xs text-violet-300">{admin.role === "super_admin" ? "Super Admin" : "Admin"}</p>
        </div>
        {mobile && (
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 text-slate-200">
            <X size={15} />
          </button>
        )}
      </div>

      <nav className="mt-4 space-y-1.5">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[15px] font-medium transition ${
                active
                  ? "border-violet-500/55 bg-violet-500/18 text-violet-100"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2">
        <a href="/" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-[13px] font-semibold text-slate-200 transition hover:bg-slate-800/80">
          <ArrowUpRight size={15} />
          Go to Chat App
        </a>
        <button onClick={onLogout} className={dangerBtnClass}>
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, compact = false }) {
  return (
    <article className={`${panelClass} ${compact ? "p-2.5" : "p-3.5 md:p-4"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className={`${compact ? "mt-1.5 text-xl" : "mt-2.5 text-4xl"} font-bold leading-none text-slate-50`}>{value ?? 0}</p>
      <p className="mt-1.5 text-xs text-slate-400">{subtitle}</p>
    </article>
  );
}

function buildLinePath(values, width, height, padding) {
  if (!Array.isArray(values) || values.length === 0) return "";

  if (values.length === 1) {
    const y = height / 2;
    return `M ${padding.toFixed(2)} ${y.toFixed(2)} L ${(width - padding).toFixed(2)} ${y.toFixed(2)}`;
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = maxValue - minValue || 1;

  return values
    .map((value, index) => {
      const progress = values.length === 1 ? 0 : index / (values.length - 1);
      const x = padding + (innerWidth * progress);
      const y = padding + innerHeight - (((value - minValue) / spread) * innerHeight);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values, width, height, padding) {
  const linePath = buildLinePath(values, width, height, padding);
  if (!linePath) return "";

  const innerWidth = width - padding * 2;
  const lastX = padding + innerWidth;
  const baseY = height - padding;
  return `${linePath} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} L ${padding.toFixed(2)} ${baseY.toFixed(2)} Z`;
}

function TrendSparkline({ values, color, gradientId }) {
  const width = 320;
  const height = 92;
  const padding = 6;
  const linePath = buildLinePath(values, width, height, padding);
  const areaPath = buildAreaPath(values, width, height, padding);

  if (!Array.isArray(values) || values.length === 0) {
    return (
      <div className="flex h-[92px] items-center justify-center rounded-xl border border-slate-700/70 bg-slate-950/35 text-xs text-slate-500">
        Waiting for live samples...
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[92px] w-full overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LiveTrendCard({ title, value, points, dataKey, color, footerLabel }) {
  const values = Array.isArray(points)
    ? points.map((point) => normalizeMetric(point?.[dataKey]))
    : [];

  const latest = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? latest;
  const delta = latest - previous;
  const gradientId = `${dataKey}-gradient`;
  const firstTime = points?.[0]?.timestamp;
  const lastTime = points?.[points.length - 1]?.timestamp;

  return (
    <article className={`${panelClass} p-3.5 md:p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold leading-none text-slate-50">{value ?? 0}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          delta > 0
            ? "border-emerald-500/45 bg-emerald-500/18 text-emerald-200"
            : delta < 0
              ? "border-rose-500/45 bg-rose-500/18 text-rose-200"
              : "border-slate-500/55 bg-slate-700/60 text-slate-200"
        }`}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-slate-700/60 bg-slate-950/45 p-2">
        <TrendSparkline values={values} color={color} gradientId={gradientId} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>{formatLiveTime(firstTime)}</span>
        <span>{formatLiveTime(lastTime)}</span>
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{footerLabel}</p>
    </article>
  );
}
