export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-10">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-glass backdrop-blur-xl">
        <h1 className="text-4xl font-semibold">AnaChat Admin Panel</h1>
        <p className="mt-4 text-slate-300">
          Manage users, email templates, audit logs, settings, and backup metadata.
        </p>
      </div>
    </main>
  );
}
