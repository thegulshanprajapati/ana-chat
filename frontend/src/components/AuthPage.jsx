import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, ShieldCheck, Sparkles, MessageCircle, Users, Zap } from "lucide-react";
import { api } from "../api/client";
import { navigateTo } from "../utils/nav";
import { useTheme } from "../context/ThemeContext";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";
const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-violet-500";
const primaryButtonClass =
  "btn-primary ring-accent inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

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

  useEffect(() => {
    if (!showGoogleSection) return;
    if (!googleClientId || !googleReady || !window.google?.accounts?.id || !googleButtonRef.current) return;

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
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-slate-50 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 dark:bg-slate-950">

      <div className="relative mx-auto w-full max-w-[1200px]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="p-4 sm:p-6">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
              {/* Hero Section */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/80 bg-purple-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-purple-700 dark:border-pink-500/35 dark:bg-pink-500/10 dark:text-pink-300">
                    <ShieldCheck size={14} />
                    AnaChat Platform
                  </div>
                  <h1 className="mt-3 font-display text-[30px] font-bold leading-[1.12] text-slate-900 sm:text-[36px] dark:text-white">
                    Connect Instantly
                  </h1>
                  <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
                    {mode === "login"
                      ? "Welcome back to your secure chat experience."
                      : "Join AnaChat with instant signup - no OTP required."}
                  </p>
                </div>

                {/* Feature highlights */}
                <div className="hidden space-y-3 sm:block">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50">
                      <Zap size={16} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Lightning Fast</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Real-time messaging with instant delivery</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/50">
                      <ShieldCheck size={16} className="text-fuchsia-600 dark:text-fuchsia-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Secure & Private</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">End-to-end encrypted conversations</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-900/50">
                      <Users size={16} className="text-pink-600 dark:text-pink-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Group Chats</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Create and manage group conversations</p>
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
                            <p className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
                              Google OAuth not configured. Add VITE_GOOGLE_CLIENT_ID to environment.
                            </p>
                          ) : googleLoadError ? (
                            <p className="rounded-xl border border-red-300/70 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                              Failed to load Google sign-in. Check network connection.
                            </p>
                          ) : !googleReady ? (
                            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
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
                    <div className="mt-4 rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 dark:border-red-500/40 dark:bg-red-500/10">
                      <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                    className="mt-6 block text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-white"
                  >
                    {mode === "login" ? "New to AnaChat? Create account" : "Already have an account? Login"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            AnaChat - Secure, fast, and beautiful messaging for everyone
          </p>
        </div>
      </div>
    </div>
  );
}
