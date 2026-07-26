import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, CheckCircle2, X, RefreshCw, KeyRound } from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

export default function ForgotPasswordModal({ open, onClose }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await resp.json();

      if (resp.status === 429) {
        setError("Too many requests. Please wait a while and try again.");
      } else if (resp.status === 400) {
        setError(data.message || "Invalid email address.");
      } else {
        // Always show success to prevent email enumeration
        setSent(true);
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setError("");
    setSent(false);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="fp-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            key="fp-modal"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-full max-w-md rounded-[24px] border border-rose-100/60 dark:border-slate-800/50 bg-white dark:bg-slate-950 shadow-[0_32px_80px_rgba(0,0,0,0.25)] p-7 relative"
          >
            {/* Close button */}
            <button
              id="forgot-password-modal-close"
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/25">
                <KeyRound className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-rose-500 dark:text-rose-400">AnaChat</p>
                <p className="text-base font-bold text-slate-900 dark:text-white">Forgot Password?</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {sent ? (
                /* Success state */
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center text-center gap-4 py-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 250, damping: 18, delay: 0.1 }}
                    className="relative"
                  >
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                      <CheckCircle2 className="h-8 w-8 text-white" />
                    </div>
                  </motion.div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Check Your Email</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      If an account exists for <strong className="text-slate-700 dark:text-slate-300">{email}</strong>,
                      you'll receive a password reset link shortly.
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      The link will expire in 15 minutes. Check your spam folder if you don't see it.
                    </p>
                  </div>

                  <button
                    onClick={handleClose}
                    className="mt-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/20 hover:shadow-rose-500/35 transition-all hover:scale-[1.02]"
                  >
                    Back to Login
                  </button>
                </motion.div>
              ) : (
                /* Email form state */
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-2">
                    Enter the email address associated with your account and we'll send you a secure reset link.
                  </p>

                  {/* Email field */}
                  <div>
                    <label
                      htmlFor="forgot-email-input"
                      className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="forgot-email-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(""); }}
                        placeholder="you@example.com"
                        required
                        disabled={loading}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Submit button */}
                  <button
                    id="forgot-password-submit"
                    type="submit"
                    disabled={loading || !email}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {loading ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Sending Link…</>
                    ) : (
                      <>Send Reset Link <ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>

                  <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                    Remembered your password?{" "}
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-rose-500 font-semibold hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
