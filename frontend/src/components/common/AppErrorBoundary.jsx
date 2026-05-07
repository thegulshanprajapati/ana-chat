import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep this log for production where devtools may be disabled.
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = (error?.message || "Something went wrong.").toString();
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-slate-950 px-5 text-slate-100">
        <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-2xl">
          <p className="text-sm font-semibold text-slate-100">App crashed after login</p>
          <p className="mt-1 text-xs text-slate-300">
            {message}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-600"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/60"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-4 text-[11px] text-slate-400">
            Tip: If you share this error message, we can fix the exact cause quickly.
          </p>
        </div>
      </div>
    );
  }
}

