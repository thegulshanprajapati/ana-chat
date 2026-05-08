import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, ShieldCheck, Sparkles, MessageCircle, Users, Zap } from "lucide-react";
import { api } from "../api/client";
import { navigateTo } from "../utils/nav";
import { useTheme } from "../context/ThemeContext";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300";
const fieldClass =
  "w-full rounded-lg border border-red-700 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/30";
const primaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60";
export default function AuthPage({ onAuthed }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState(false);
  const googleButtonRef = useRef(null);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const showGoogleSection = mode === "signup";

  const handleGoogleCredential = useCallback(async (response) => {
    const idToken = response?.credential;
    if (!idToken) {
      setError("Google sign-in did not return a credential.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await api.post("/auth/google", { idToken });
      await onAuthed();
    } catch (err) {
      setError(err.response?.data?.message || "Google login failed");
    } finally {
      setLoading(false);
    }
  }, [onAuthed]);

  useEffect(() => {
    if (!googleClientId) return;

    if (window.google?.accounts?.id) {
      setGoogleReady(true);
      return;
    }

    const scriptId = "google-identity-service";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    function onLoad() {
      setGoogleReady(true);
      setGoogleLoadError(false);
    }

    function onError() {
      setGoogleLoadError(true);
    }

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, [googleClientId]);

  const googleInitializedRef = useRef(false);

  useEffect(() => {
    if (!showGoogleSection) return;
    if (!googleClientId || !googleReady || !window.google?.accounts?.id || !googleButtonRef.current) return;
    if (googleInitializedRef.current) return;

    const width = Math.max(0, Math.min(390, googleButtonRef.current.offsetWidth || 0));
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential
    });
    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: theme === "dark" ? "filled_black" : "outline",
      size: "large",
      ...(width ? { width } : null),
      shape: "pill",
      text: "continue_with"
    });
    googleInitializedRef.current = true;
  }, [googleClientId, googleReady, handleGoogleCredential, showGoogleSection, theme]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = Object.fromEntries(new FormData(e.target).entries());
      const { data } = await api.post("/auth/login", {
        email_or_mobile: payload.email_or_mobile,
        password: payload.password
      });

      if (data?.mode === "admin" && data?.admin?.id) {
        navigateTo("admin");
        return;
      }
      await onAuthed();
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupForm(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = Object.fromEntries(new FormData(e.target).entries());
      await api.post("/auth/signup", payload);
      await onAuthed();
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-black px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 text-white">

      <div className="relative mx-auto w-full max-w-[1200px]">
        <div className="rounded-3xl border border-red-700 bg-[#090909] shadow-[0_20px_80px_rgba(255,0,0,0.12)]">
          <div className="p-4 sm:p-6">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
              {/* Hero Section */}
              <div className="rounded-3xl border border-red-700 bg-[#111111] p-5 sm:p-8">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-red-300">
                    <ShieldCheck size={14} />
                    AnaChat Secure
                  </div>
                  <h1 className="mt-3 font-display text-[30px] font-bold leading-[1.12] text-white sm:text-[36px]">
                    Red. Fast. Private.
                  </h1>
                  <p className="mt-2 text-base text-red-200">
                    {mode === "login"
                      ? "Sign in and continue your chat sessions instantly."
                      : "Create your account now and join the secure AnaChat network."}
                  </p>
                </div>

                {/* Feature highlights */}
                <div className="hidden space-y-3 sm:block">
                  <div className="flex items-center gap-3 rounded-2xl border border-red-700 bg-black/80 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600/10">
                      <Zap size={16} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Lightning Fast</p>
                      <p className="text-xs text-red-200">Real-time messaging with instant delivery.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-red-700 bg-black/80 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600/10">
                      <ShieldCheck size={16} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Secure & Private</p>
                      <p className="text-xs text-red-200">Encrypted chats and trusted privacy controls.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-red-700 bg-black/80 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600/10">
                      <Users size={16} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Group Chat Ready</p>
                      <p className="text-xs text-red-200">Create rooms, invite friends, and stay connected.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex dark:border-slate-700 dark:bg-slate-950">
                  <Sparkles size={16} className="text-purple-500 animate-pulse" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Join thousands of users already chatting on AnaChat
                  </p>
                </div>
              </div>

              {/* Auth Form Section */}
              <div className="min-h-0">
                <div className="pr-1">
                  <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        mode === "login"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        mode === "signup"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      Signup
                    </button>
                  </div>

                  {mode === "login" ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block">
                          <span className={labelClass}>Email or Mobile</span>
                          <input
                            name="email_or_mobile"
                            required
                            autoComplete="username"
                            className={fieldClass}
                            placeholder="name@email.com or 98XXXXXXXX"
                          />
                        </label>
                      </div>
                      <div className="space-y-1">
                        <label className="block">
                          <span className={labelClass}>Password</span>
                          <input
                            name="password"
                            required
                            type="password"
                            autoComplete="current-password"
                            className={fieldClass}
                            placeholder="Enter your password"
                          />
                        </label>
                      </div>
                      <button disabled={loading} className={`${primaryButtonClass} mt-5`}>
                        <MessageCircle size={16} className="mr-2" />
                        {loading ? "Signing you in..." : "Login to AnaChat"}
                      </button>
                    </form>
                  ) : (
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                      <div className="space-y-4">
                        <form onSubmit={handleSignupForm} className="grid gap-4 sm:grid-cols-2">
                          <label className="block sm:col-span-2">
                            <span className={labelClass}>Full Name</span>
                            <input
                              name="name"
                              required
                              autoComplete="name"
                              className={fieldClass}
                              placeholder="Your full name"
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Email</span>
                            <input
                              name="email"
                              required
                              type="email"
                              autoComplete="email"
                              className={fieldClass}
                              placeholder="you@company.com"
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Mobile</span>
                            <input
                              name="mobile"
                              required
                              autoComplete="tel"
                              className={fieldClass}
                              placeholder="98XXXXXXXX"
                            />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className={labelClass}>Password</span>
                            <input
                              name="password"
                              required
                              type="password"
                              autoComplete="new-password"
                              className={fieldClass}
                              placeholder="Create a secure password (min 6 characters)"
                            />
                          </label>
                          <button disabled={loading} className={`${primaryButtonClass} sm:col-span-2 mt-2`}>
                            <BadgeCheck size={16} className="mr-2" />
                            {loading ? "Creating your account..." : "Join AnaChat"}
                          </button>
                        </form>
                      </div>

                      {showGoogleSection && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                          <div className="mb-4 flex items-center gap-3">
                            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Quick Google Signup</span>
                            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                          </div>

                          {!googleClientId ? (
                            <p className="rounded-2xl border border-red-700 bg-[#110000] px-3 py-2 text-xs text-red-200">
                              Google OAuth not configured. Add VITE_GOOGLE_CLIENT_ID to environment.
                            </p>
                          ) : googleLoadError ? (
                            <p className="rounded-2xl border border-red-700 bg-[#110000] px-3 py-2 text-xs text-red-200">
                              Failed to load Google sign-in. Check network connection.
                            </p>
                          ) : !googleReady ? (
                            <p className="rounded-2xl border border-red-700 bg-[#110000] px-3 py-2 text-xs text-red-200">
                              Loading Google sign-in...
                            </p>
                          ) : (
                            <div ref={googleButtonRef} className="flex min-h-[44px] max-w-full items-center justify-center overflow-hidden" />
                          )}
                          {googleClientId && (
                            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                              Origin for Google OAuth: <span className="font-semibold text-slate-700 dark:text-slate-200">{currentOrigin}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 rounded-2xl border border-red-700 bg-[#220000] px-4 py-3">
                      <p className="text-sm text-red-200">{error}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                    className="mt-6 block text-sm font-semibold text-red-200 underline decoration-red-500 underline-offset-4 transition hover:text-white"
                  >
                    {mode === "login" ? "New to AnaChat? Create account" : "Already have an account? Login"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-medium text-red-200">
            AnaChat — secure messaging built for speed and privacy.
          </p>
        </div>
      </div>
    </div>
  );
}
