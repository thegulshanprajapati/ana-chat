import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Eye, EyeOff, CheckCircle2, XCircle, ArrowLeft,
  AlertTriangle, RefreshCw, Shield, KeyRound
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

function PasswordStrengthMeter({ password }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
    { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) }
  ];
  const passed = checks.filter(c => c.ok).length;
  const pct = (passed / checks.length) * 100;

  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const color = passed === 0 ? "#e2e8f0" : colors[passed - 1];
  const strengthLabel = passed === 0 ? "" : labels[passed - 1];

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {strengthLabel && (
          <span className="text-xs font-semibold" style={{ color }}>{strengthLabel}</span>
        )}
      </div>
      {/* Requirement checklist */}
      <div className="grid grid-cols-1 gap-1">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-1.5">
            {c.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
            )}
            <span className={`text-xs ${c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessScreen({ onLogin }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center text-center py-8 gap-5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        className="relative"
      >
        <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <CheckCircle2 className="h-10 w-10 text-white" />
        </div>
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Password Updated!</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your password has been changed successfully.<br />
          All other sessions have been logged out for your security.
        </p>
      </div>

      <button
        onClick={onLogin}
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Login
      </button>
    </motion.div>
  );
}

function ErrorScreen({ reason, onRequestNew }) {
  const configs = {
    expired: {
      icon: <AlertTriangle className="h-10 w-10 text-amber-500" />,
      bg: "from-amber-400 to-orange-500",
      title: "Link Expired",
      desc: "This password reset link has expired. Reset links are valid for 15 minutes."
    },
    already_used: {
      icon: <Shield className="h-10 w-10 text-blue-500" />,
      bg: "from-blue-400 to-indigo-500",
      title: "Link Already Used",
      desc: "This reset link has already been used. For security, each link can only be used once."
    },
    invalid_token: {
      icon: <XCircle className="h-10 w-10 text-rose-500" />,
      bg: "from-rose-400 to-red-500",
      title: "Invalid Link",
      desc: "This password reset link is invalid or malformed."
    },
    server_error: {
      icon: <XCircle className="h-10 w-10 text-rose-500" />,
      bg: "from-rose-400 to-red-500",
      title: "Something Went Wrong",
      desc: "We could not verify your reset link. Please try again."
    }
  };

  const cfg = configs[reason] || configs.invalid_token;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center text-center py-8 gap-5"
    >
      <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${cfg.bg} flex items-center justify-center shadow-lg`}>
        {cfg.icon}
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{cfg.title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{cfg.desc}</p>
      </div>

      <button
        onClick={onRequestNew}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all hover:scale-[1.02]"
      >
        <RefreshCw className="h-4 w-4" />
        Request New Link
      </button>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [verifyStatus, setVerifyStatus] = useState("verifying"); // verifying | valid | invalid
  const [errorReason, setErrorReason] = useState("invalid_token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  // Extract token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);

    if (!t) {
      setVerifyStatus("invalid");
      setErrorReason("invalid_token");
      return;
    }

    // Verify token on mount
    fetch(`${API}/auth/reset-password/verify?token=${encodeURIComponent(t)}`, {
      credentials: "include"
    })
      .then(r => r.json().then(d => ({ ok: r.ok, ...d })))
      .then(data => {
        if (data.valid) {
          setVerifyStatus("valid");
        } else {
          setVerifyStatus("invalid");
          setErrorReason(data.reason || "invalid_token");
        }
      })
      .catch(() => {
        setVerifyStatus("invalid");
        setErrorReason("server_error");
      });
  }, []);

  const isPasswordValid = useCallback(() => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!isPasswordValid()) {
      setSubmitError("Please ensure your password meets all requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password })
      });
      const data = await resp.json();

      if (resp.ok) {
        setDone(true);
      } else {
        setSubmitError(data.message || "Failed to reset password. Please try again.");
        if (resp.status === 410) {
          setVerifyStatus("invalid");
          setErrorReason(data.message?.includes("used") ? "already_used" : "expired");
        }
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    window.location.href = "/";
  };

  const goToForgotPassword = () => {
    window.location.href = "/?forgot=1";
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-slate-950 dark:via-slate-950 dark:to-rose-950/20 p-4 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-rose-200/30 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-pink-200/30 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-[28px] border border-rose-100/60 dark:border-slate-800/50 bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl shadow-[0_30px_80px_rgba(225,29,72,0.12)] p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/30">
              <KeyRound className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-rose-600 dark:text-rose-400">AnaChat Security</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Reset Password</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Verifying */}
            {verifyStatus === "verifying" && (
              <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-4 border-rose-200 dark:border-rose-900/50 border-t-rose-500 animate-spin" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Verifying your reset link…</p>
              </motion.div>
            )}

            {/* Success */}
            {done && (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SuccessScreen onLogin={goToLogin} />
              </motion.div>
            )}

            {/* Error */}
            {verifyStatus === "invalid" && !done && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ErrorScreen reason={errorReason} onRequestNew={goToForgotPassword} />
              </motion.div>
            )}

            {/* Reset Form */}
            {verifyStatus === "valid" && !done && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Create New Password</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Choose a strong password for your account.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="reset-password-input"
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password && <PasswordStrengthMeter password={password} />}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="reset-confirm-password-input"
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        className={`w-full rounded-xl border py-3 pl-10 pr-10 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition
                          ${confirmPassword && confirmPassword !== password
                            ? "border-red-400 focus:ring-red-400 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-rose-400"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Passwords do not match
                      </p>
                    )}
                    {confirmPassword && confirmPassword === password && (
                      <p className="mt-1 text-xs text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                      </p>
                    )}
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-400"
                      >
                        <XCircle className="h-4 w-4 shrink-0" />
                        {submitError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <button
                    id="reset-password-submit"
                    type="submit"
                    disabled={submitting || !password || !confirmPassword}
                    className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Updating Password…</>
                    ) : (
                      <><Shield className="h-4 w-4" /> Update Password</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition flex items-center justify-center gap-1 py-1"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back to Login
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom badge */}
        <p className="text-center mt-4 text-[11px] text-slate-400 dark:text-slate-600">
          🔒 Secured by AnaChat end-to-end encryption
        </p>
      </motion.div>
    </div>
  );
}
