import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Sparkles,
  User
} from "lucide-react";
import { api, setStoredAccessToken } from "../api/client";
import { navigateTo } from "../utils/nav";
import { useTheme } from "../context/ThemeContext";
import { getStoredRsaKeyPair, persistRsaKeyPair, decryptPrivateKeyBackup } from "../utils/e2ee";

function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</label>
        {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
      </div>
      {children}
      <AnimatePresence>
        {error ? (
          <motion.p
            className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SegmentedControl({ value, onChange, items }) {
  return (
    <div className="grid grid-cols-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 p-1.5 border border-slate-200/60 dark:border-slate-700/60">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={[
              "relative rounded-xl px-4 py-3 text-sm font-semibold transition",
              selected
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AuthPage({ onAuthed }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [formData, setFormData] = useState({ email_or_mobile: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [activeDeviceSessions, setActiveDeviceSessions] = useState([]);
  const [deviceLimit, setDeviceLimit] = useState(null);
  const [deviceLogoutLoading, setDeviceLogoutLoading] = useState(null);

  const googleButtonRef = useRef(null);
  const googleInitializedRef = useRef(false);
  const emailInputRef = useRef(null);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

  const showGoogleSection = mode === "signup";
  const isDark = (theme || "").toLowerCase() === "dark";

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validateMobile = (mobile) => /^[6-9]\d{9}$/.test((mobile || "").replace(/\s+/g, ""));
  const validatePassword = (password) => (password || "").length >= 6;

  const validateField = (name, value) => {
    if (name === "email_or_mobile") {
      if (!value.trim()) return "Email or mobile is required";
      if (value.includes("@")) return validateEmail(value) ? "" : "Please enter a valid email address";
      return validateMobile(value) ? "" : "Please enter a valid 10-digit mobile number";
    }
    if (name === "password") {
      if (!value) return "Password is required";
      return validatePassword(value) ? "" : "Password must be at least 6 characters";
    }
    return "";
  };

  const heroChips = useMemo(
    () => ({
      title: "AnaChat",
      tagline: "Cozy, secure chats — in seconds.",
      highlights: ["Fast setup", "End-to-end ready", "Cute reactions"],
      stats: [
        { label: "Secure by design", value: "AES / RSA" },
        { label: "Instant login", value: "< 10s" }
      ]
    }),
    []
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleInputBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleKeyDown = (e) => setCapsLockOn(Boolean(e.getModifierState?.("CapsLock")));
  const handleKeyUp = (e) => {
    if (!e.getModifierState?.("CapsLock")) setCapsLockOn(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetMessage("Please enter your email address");
      return;
    }

    setResetLoading(true);
    setResetMessage("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      setResetMessage("If an account with that email exists, we've sent you a password reset link.");
    } catch {
      setResetMessage("Failed to send reset email. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  async function maybeRestoreOldChats(userData) {
    if (!userData || !userData.id || !userData.publicKey) return;
    const localKey = await getStoredRsaKeyPair(userData.id);
    if (localKey) return;

    if (!userData.hasPrivateKeyBackup) {
      return;
    }

    const restore = window.confirm(
      "A previous device has your chat encryption key. Do you want to restore old chats on this device?"
    );
    if (!restore) return;

    const pin = window.prompt("Enter your restore PIN to restore old chats:");
    if (!pin) return;

    try {
      const { data } = await api.post("/auth/restore-key", { pin });
      const privateJwk = await decryptPrivateKeyBackup(data.encryptedPrivateKey, pin);
      await persistRsaKeyPair(userData.id, {
        publicJwk: userData.publicKey,
        privateJwk,
        createdAt: Date.now()
      });
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Restore failed";
      window.alert(message);
    }
  }

  const handleGoogleCredential = useCallback(
    async (response) => {
      const idToken = response?.credential;
      if (!idToken) {
        setError("Google sign-in did not return a credential.");
        return;
      }

      setError("");
      setLoading(true);
      try {
        const { data } = await api.post("/auth/google", { idToken });
        if (data?.accessToken) {
          setStoredAccessToken(data.accessToken);
        }
        await maybeRestoreOldChats(data);
        await onAuthed();
      } catch (err) {
        const message = err.response?.data?.message || "Google login failed";
        setError(message);
        if (err.response?.status === 403 && err.response?.data?.activeSessions) {
          setActiveDeviceSessions(err.response.data.activeSessions || []);
          setDeviceLimit(err.response.data?.maxActiveDevices || null);
        }
      } finally {
        setLoading(false);
      }
    },
    [onAuthed]
  );

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
    if (mode === "login") {
      googleInitializedRef.current = false;
      setTimeout(() => emailInputRef.current?.focus?.(), 50);
    }
  }, [mode]);

  useEffect(() => {
    if (!showGoogleSection) return;
    if (!googleClientId || !googleReady || !window.google?.accounts?.id || !googleButtonRef.current) return;
    if (googleInitializedRef.current) return;

    const width = Math.max(0, Math.min(390, googleButtonRef.current.offsetWidth || 0));
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: isDark ? "filled_black" : "outline",
      size: "large",
      ...(width ? { width } : null),
      shape: "pill",
      text: "continue_with"
    });
    googleInitializedRef.current = true;
  }, [googleClientId, googleReady, handleGoogleCredential, isDark, showGoogleSection]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setFieldErrors({});
    setTouched({});
    setFormData({ email_or_mobile: "", password: "" });
    setCapsLockOn(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setActiveDeviceSessions([]);
    setDeviceLimit(null);

    const errors = {};
    Object.keys(formData).forEach((field) => {
      const message = validateField(field, formData[field]);
      if (message) errors[field] = message;
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({ email_or_mobile: true, password: true });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        email_or_mobile: formData.email_or_mobile,
        password: formData.password,
        remember_me: rememberMe
      });

      if (data?.accessToken) {
        setStoredAccessToken(data.accessToken);
      }

      await maybeRestoreOldChats(data);
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => {
        if (data?.mode === "admin" && data?.admin?.id) {
          navigateTo("admin");
          return;
        }
        onAuthed();
      }, 900);
    } catch (err) {
      const message = err.response?.data?.message || "Login failed";
      setError(message);
      if (message.toLowerCase().includes("invalid credentials")) {
        setFieldErrors({
          email_or_mobile: "Invalid email/mobile or password",
          password: "Invalid email/mobile or password"
        });
      }
      if (err.response?.status === 403 && err.response?.data?.activeSessions) {
        setActiveDeviceSessions(err.response.data.activeSessions || []);
        setDeviceLimit(err.response.data?.maxActiveDevices || null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoutDevice(sessionId) {
    setError("");
    setSuccess("");
    setDeviceLogoutLoading(sessionId);

    try {
      await api.post("/auth/devices/revoke", {
        email_or_mobile: formData.email_or_mobile,
        password: formData.password,
        sessionId
      });
      setSuccess("Device logged out successfully. Please retry login.");
      setActiveDeviceSessions((prev) => prev.filter((item) => item.id !== sessionId));
    } catch (err) {
      const message = err.response?.data?.message || "Unable to logout device";
      setError(message);
    } finally {
      setDeviceLogoutLoading(null);
    }
  }

  async function handleSignupForm(e) {
    e.preventDefault();
    setError("");
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const password = (payload.password || "").toString();
    const confirmPassword = (payload.confirm_password || "").toString();

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", payload);
      if (data?.accessToken) {
        setStoredAccessToken(data.accessToken);
      }
      await onAuthed();
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.35, staggerChildren: 0.06 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
  };

  return (
    <motion.div
      className={[
        "min-h-screen w-full overflow-y-auto relative",
        "bg-gradient-to-br from-slate-50 via-white to-rose-50",
        "dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
      ].join(" ")}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-60 dark:opacity-35 bg-[radial-gradient(1100px_circle_at_15%_10%,rgba(244,63,94,0.18),transparent_40%),radial-gradient(900px_circle_at_85%_20%,rgba(168,85,247,0.15),transparent_40%),radial-gradient(900px_circle_at_50%_90%,rgba(14,165,233,0.12),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.6),rgba(255,255,255,0.0))] dark:bg-[linear-gradient(to_bottom,rgba(2,6,23,0.85),rgba(2,6,23,0.0))]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-stretch px-4 py-10 sm:px-6 lg:px-10">
        <motion.div
          className="grid w-full grid-cols-1 overflow-hidden rounded-[28px] border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl shadow-[0_30px_90px_rgba(15,23,42,0.12)]"
          variants={itemVariants}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative hidden lg:block p-10">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-400/20 blur-3xl" />
                <div className="absolute right-[-90px] top-24 h-72 w-72 rounded-full bg-fuchsia-400/15 blur-3xl" />
                <div className="absolute bottom-[-120px] left-16 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
              </div>

              <div className="relative flex h-full flex-col justify-between">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <Sparkles className="h-4 w-4 text-rose-500" />
                    {heroChips.title}
                  </div>

                  <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{heroChips.tagline}</h1>

                  <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    {heroChips.highlights.map((text) => (
                      <li key={text} className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        {text}
                      </li>
                    ))}
                  </ul>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {heroChips.stats.map((s) => (
                      <div
                        key={s.label}
                        className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/30 px-4 py-4"
                      >
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.label}</div>
                        <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-10 rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/30 p-6">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="mt-0.5 h-5 w-5 text-rose-500" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Tip</div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Use email or mobile for login. New here? Create an account in under a minute.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-600 dark:text-rose-400">Welcome</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {mode === "login" ? "Sign in to continue" : "Create your account"}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {mode === "login" ? "Pick up where you left off." : "Start chatting with a fresh, secure profile."}
                </p>
              </div>

              <div className="mt-6">
                <SegmentedControl
                  value={mode}
                  onChange={switchMode}
                  items={[
                    { value: "login", label: "Login" },
                    { value: "signup", label: "Sign up" }
                  ]}
                />
              </div>

              <AnimatePresence>
                {success ? (
                  <motion.div
                    className="mt-5 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/25 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {success}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {error ? (
                  <motion.div
                    className="mt-5 rounded-2xl border border-rose-200/70 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/25 px-4 py-3 text-sm text-rose-800 dark:text-rose-200 flex items-center gap-2"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <AlertCircle className="h-5 w-5" />
                    {error}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {activeDeviceSessions.length > 0 ? (
                <motion.div
                  className="mt-4 rounded-2xl border border-amber-200/70 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/25 p-4 text-sm text-amber-950 dark:text-amber-100"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">Active devices limit reached</div>
                      {deviceLimit ? (
                        <div className="text-xs text-amber-700 dark:text-amber-300">You can have up to {deviceLimit} active devices.</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {activeDeviceSessions.map((session) => (
                      <div key={session.id} className="rounded-2xl border border-amber-200/80 bg-white/80 dark:bg-slate-950/80 p-3 text-slate-800 dark:text-slate-100">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{session.user_agent || "Unknown device"}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">IP: {session.ip || "Unknown"}</div>
                          </div>
                          <button
                            type="button"
                            disabled={deviceLogoutLoading === session.id}
                            onClick={() => handleLogoutDevice(session.id)}
                            className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deviceLogoutLoading === session.id ? "Logging out..." : "Logout device"}
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                          Last used: {new Date(session.last_used_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}

              <div className="mt-6">
                {mode === "login" ? (
                  <motion.form
                    key="login"
                    onSubmit={handleLogin}
                    className="space-y-5"
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <Field label="Email / Mobile" error={fieldErrors.email_or_mobile}>
                      <div className="relative">
                        <input
                          ref={emailInputRef}
                          name="email_or_mobile"
                          value={formData.email_or_mobile}
                          onChange={handleInputChange}
                          onBlur={handleInputBlur}
                          autoComplete="username"
                          required
                          placeholder="name@email.com or 9876543210"
                          className={[
                            "w-full rounded-2xl border px-4 py-3.5 pr-10 text-sm outline-none transition",
                            "bg-white/80 dark:bg-slate-950/40",
                            "text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
                            fieldErrors.email_or_mobile
                              ? "border-rose-300/70 dark:border-rose-900/70 focus:ring-2 focus:ring-rose-500/30"
                              : "border-slate-200/70 dark:border-slate-800/70 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-200/70"
                          ].join(" ")}
                        />
                        <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </Field>

                    <Field label="Password" hint={capsLockOn ? "Caps Lock is ON" : ""} error={fieldErrors.password}>
                      <div className="relative">
                        <input
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          onBlur={handleInputBlur}
                          onKeyDown={handleKeyDown}
                          onKeyUp={handleKeyUp}
                          autoComplete="current-password"
                          required
                          type={showPassword ? "text" : "password"}
                          placeholder="Your password"
                          className={[
                            "w-full rounded-2xl border px-4 py-3.5 pr-11 text-sm outline-none transition",
                            "bg-white/80 dark:bg-slate-950/40",
                            "text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
                            fieldErrors.password
                              ? "border-rose-300/70 dark:border-rose-900/70 focus:ring-2 focus:ring-rose-500/30"
                              : "border-slate-200/70 dark:border-slate-800/70 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-200/70"
                          ].join(" ")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>

                    <div className="flex items-center justify-between gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                        Remember me
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                      >
                        Forgot?
                      </button>
                    </div>

                    <button
                      disabled={loading}
                      className="group w-full rounded-2xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 disabled:opacity-60 text-white font-semibold px-4 py-3.5 transition shadow-[0_16px_40px_rgba(225,29,72,0.25)] flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                      No signup fees · Cute stickers · Start chatting instantly
                    </p>
                  </motion.form>
                ) : (
                  <motion.div key="signup" className="space-y-5" variants={itemVariants} initial="hidden" animate="visible">
                    <form onSubmit={handleSignupForm} className="space-y-5">
                      <Field label="Full name">
                        <div className="relative">
                          <input
                            name="name"
                            required
                            autoComplete="name"
                            placeholder="Your name"
                            className="w-full rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/40 px-4 py-3.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-200/70 transition"
                          />
                          <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                      </Field>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Email">
                          <div className="relative">
                            <input
                              name="email"
                              required
                              type="email"
                              autoComplete="email"
                              placeholder="name@email.com"
                              className="w-full rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/40 px-4 py-3.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-200/70 transition"
                            />
                            <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          </div>
                        </Field>

                        <Field label="Mobile">
                          <div className="relative">
                            <input
                              name="mobile"
                              required
                              autoComplete="tel"
                              placeholder="9876543210"
                              className="w-full rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/40 px-4 py-3.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-200/70 transition"
                            />
                            <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          </div>
                        </Field>
                      </div>

                      <Field label="Password" hint="Min 6 characters">
                        <div className="relative">
                          <input
                            name="password"
                            required
                            type={showSignupPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Create a password"
                            className="w-full rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/40 px-4 py-3.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-200/70 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignupPassword((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                            aria-label={showSignupPassword ? "Hide password" : "Show password"}
                          >
                            {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>

                      <Field label="Confirm password">
                        <div className="relative">
                          <input
                            name="confirm_password"
                            required
                            type={showSignupConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Confirm your password"
                            className="w-full rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/40 px-4 py-3.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-200/70 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignupConfirmPassword((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                            aria-label={showSignupConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          >
                            {showSignupConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>

                      <button
                        disabled={loading}
                        className="group w-full rounded-2xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 disabled:opacity-60 text-white font-semibold px-4 py-3.5 transition shadow-[0_16px_40px_rgba(225,29,72,0.25)] flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            Create account
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </button>

                      {showGoogleSection ? (
                        <div className="pt-2">
                          <div className="relative my-4 flex items-center">
                            <div className="h-px flex-1 bg-slate-200/70 dark:bg-slate-800/70" />
                            <span className="px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">or</span>
                            <div className="h-px flex-1 bg-slate-200/70 dark:bg-slate-800/70" />
                          </div>

                          {!googleClientId ? (
                            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/25 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                              <KeyRound className="h-4 w-4" />
                              Google OAuth not configured. Add `VITE_GOOGLE_CLIENT_ID`.
                            </div>
                          ) : googleLoadError ? (
                            <div className="rounded-2xl border border-rose-200/70 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/25 px-4 py-3 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              Failed to load Google sign-in. Please refresh.
                            </div>
                          ) : !googleReady ? (
                            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/25 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Loading Google sign-in...
                            </div>
                          ) : (
                            <div ref={googleButtonRef} className="flex justify-center" />
                          )}
                        </div>
                      ) : null}
                    </form>
                  </motion.div>
                )}
              </div>

              <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                  className="font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                >
                  {mode === "login" ? "New here? Create an account" : "Already have an account? Login"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showForgotPassword ? (
          <motion.div
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForgotPassword(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-[24px] border border-slate-200/70 dark:border-slate-800/70 bg-white/85 dark:bg-slate-950/70 backdrop-blur-xl shadow-[0_30px_90px_rgba(15,23,42,0.35)] p-6"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">Reset password</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    We’ll email a reset link if the account exists.
                  </div>
                </div>
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email address</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/40 px-4 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-200/70 transition"
                    placeholder="name@email.com"
                    required
                  />
                </div>

                <AnimatePresence>
                  {resetMessage ? (
                    <motion.div
                      className={[
                        "rounded-2xl border px-4 py-3 text-xs",
                        resetMessage.includes("sent")
                          ? "border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/25 text-emerald-800 dark:text-emerald-200"
                          : "border-rose-200/70 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/25 text-rose-800 dark:text-rose-200"
                      ].join(" ")}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                    >
                      {resetMessage}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/35 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition flex items-center justify-center gap-2"
                  >
                    {resetLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" />
                        Send link
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
