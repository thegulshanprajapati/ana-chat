import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BadgeCheck, ShieldCheck, Sparkles, MessageCircle, Users, Zap, Mail, Lock, User, Phone } from "lucide-react";
import { api } from "../api/client";
import { navigateTo } from "../utils/nav";
import { useTheme } from "../context/ThemeContext";

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
      theme: "outline",
      size: "large",
      ...(width ? { width } : null),
      shape: "pill",
      text: "continue_with"
    });
    googleInitializedRef.current = true;
  }, [googleClientId, googleReady, handleGoogleCredential, showGoogleSection]);

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 30 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const floatingVariants = {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden relative"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-32 -right-32 w-96 h-96 bg-red-100/30 rounded-full blur-3xl"
          variants={floatingVariants}
          animate="animate"
        />
        <motion.div
          className="absolute -bottom-32 -left-32 w-96 h-96 bg-gray-200/40 rounded-full blur-3xl"
          variants={floatingVariants}
          animate="animate"
          style={{ animationDelay: "2s" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-50/20 rounded-full blur-3xl"
          variants={floatingVariants}
          animate="animate"
          style={{ animationDelay: "4s" }}
        />
      </div>

      <div className="relative w-full max-w-7xl mx-auto">
        <div className="grid gap-8 md:gap-12 lg:gap-16 md:grid-cols-2 items-stretch min-h-[calc(100vh-4rem)]">
          {/* Left Side - Branding */}
          <motion.div
            className="hidden md:flex flex-col justify-center gap-8 lg:gap-10 h-full order-2 md:order-1"
            variants={itemVariants}
          >
            <motion.div className="space-y-6 lg:space-y-8" variants={itemVariants}>
              <motion.div
                className="inline-flex items-center gap-3 px-5 py-2.5 bg-red-50/80 border border-red-100/50 rounded-full backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <ShieldCheck className="w-5 h-5 text-red-600" />
                <span className="text-sm font-semibold text-red-700">AnaChat Secure</span>
              </motion.div>

              <motion.div className="space-y-4 lg:space-y-6" variants={itemVariants}>
                <motion.h1
                  className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight"
                  variants={itemVariants}
                >
                  Connect Instantly,<br />
                  <span className="text-red-600">Chat Securely</span>
                </motion.h1>
                <motion.p
                  className="text-lg sm:text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-lg"
                  variants={itemVariants}
                >
                  {mode === "login"
                    ? "Welcome back! Continue your conversations with end-to-end encryption."
                    : "Join thousands of users in secure, real-time messaging. Create your account today."}
                </motion.p>
              </motion.div>
            </motion.div>

            {/* Feature Cards */}
            <motion.div className="grid gap-4 lg:gap-6" variants={itemVariants}>
              {[
                { icon: Zap, title: "Lightning Fast", desc: "Real-time messaging with instant delivery" },
                { icon: ShieldCheck, title: "End-to-End Security", desc: "Your conversations are fully encrypted" },
                { icon: Users, title: "Group Conversations", desc: "Create rooms and invite friends" }
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  className="bg-white/80 backdrop-blur-sm p-6 lg:p-8 rounded-2xl shadow-sm border border-gray-100/50 hover:shadow-lg hover:shadow-red-100/20 transition-all duration-300"
                  whileHover={{ y: -4, scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  variants={itemVariants}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-4 lg:gap-6">
                    <motion.div
                      className="w-12 h-12 lg:w-14 lg:h-14 bg-red-50 rounded-xl flex items-center justify-center"
                      whileHover={{ rotate: 5 }}
                    >
                      <feature.icon className="w-6 h-6 lg:w-7 lg:h-7 text-red-600" />
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base lg:text-lg">{feature.title}</h3>
                      <p className="text-sm lg:text-base text-gray-600">{feature.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Trust Indicator */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm p-6 lg:p-8 rounded-2xl shadow-sm border border-gray-100/50"
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-red-500" />
                <span className="text-sm lg:text-base font-medium text-gray-700">
                  Trusted by thousands of users worldwide
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side - Auth Card */}
          <motion.div
            className="w-full mx-auto md:mx-0 flex h-full items-center justify-center order-1 md:order-2"
            variants={itemVariants}
          >
            <motion.div
              className="w-full max-w-lg lg:max-w-xl bg-white/95 backdrop-blur-xl rounded-[32px] shadow-[0_32px_80px_rgba(15,23,42,0.08)] border border-gray-100/50 p-8 sm:p-10 lg:p-12 hover:shadow-[0_40px_120px_rgba(15,23,42,0.12)] transition-all duration-500 flex flex-col justify-between min-h-[520px] lg:min-h-[600px]"
              variants={cardVariants}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.3 }}
            >
              {/* Tabs */}
              <motion.div
                className="flex rounded-2xl bg-gray-50/80 p-1.5 mb-8 lg:mb-10 backdrop-blur-sm border border-gray-100/50"
                variants={itemVariants}
              >
                <motion.button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`flex-1 py-3 lg:py-4 px-4 lg:px-6 rounded-xl font-semibold text-sm lg:text-base transition-all duration-300 ${
                    mode === "login"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Login
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`flex-1 py-3 lg:py-4 px-4 lg:px-6 rounded-xl font-semibold text-sm lg:text-base transition-all duration-300 ${
                    mode === "signup"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Sign Up
                </motion.button>
              </motion.div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="mb-6 lg:mb-8 p-4 lg:p-5 bg-red-50/80 border border-red-200/50 rounded-2xl backdrop-blur-sm"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 text-xs font-bold">!</span>
                      </div>
                      <p className="text-sm lg:text-base text-red-700">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {mode === "login" ? (
                  <motion.form
                    key="login"
                    onSubmit={handleLogin}
                    className="space-y-6 lg:space-y-8 flex-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div className="space-y-2" variants={itemVariants}>
                      <label className="block">
                        <div className="relative group">
                          <motion.input
                            name="email_or_mobile"
                            required
                            autoComplete="username"
                            className="w-full px-4 lg:px-5 py-4 lg:py-5 bg-gray-50/80 border border-gray-200/50 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-300/50 transition-all duration-300 backdrop-blur-sm"
                            placeholder="Email or Mobile"
                            whileFocus={{ scale: 1.01 }}
                          />
                          <motion.div
                            className="absolute right-4 top-1/2 transform -translate-y-1/2"
                            whileHover={{ scale: 1.1 }}
                          >
                            <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors duration-300" />
                          </motion.div>
                        </div>
                      </label>
                    </motion.div>

                    <motion.div className="space-y-2" variants={itemVariants}>
                      <label className="block">
                        <div className="relative group">
                          <motion.input
                            name="password"
                            required
                            type="password"
                            autoComplete="current-password"
                            className="w-full px-4 lg:px-5 py-4 lg:py-5 bg-gray-50/80 border border-gray-200/50 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-300/50 transition-all duration-300 backdrop-blur-sm"
                            placeholder="Password"
                            whileFocus={{ scale: 1.01 }}
                          />
                          <motion.div
                            className="absolute right-4 top-1/2 transform -translate-y-1/2"
                            whileHover={{ scale: 1.1 }}
                          >
                            <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors duration-300" />
                          </motion.div>
                        </div>
                      </label>
                    </motion.div>

                    <motion.button
                      disabled={loading}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-4 lg:py-5 px-6 lg:px-8 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-3 backdrop-blur-sm"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      variants={itemVariants}
                    >
                      <MessageCircle className="w-5 h-5" />
                      {loading ? "Signing you in..." : "Login to AnaChat"}
                    </motion.button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="signup"
                    className="space-y-6 lg:space-y-8 flex-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.form onSubmit={handleSignupForm} className="space-y-6 lg:space-y-8">
                      <motion.div className="space-y-2" variants={itemVariants}>
                        <label className="block">
                          <div className="relative group">
                            <motion.input
                              name="name"
                              required
                              autoComplete="name"
                              className="w-full px-4 lg:px-5 py-4 lg:py-5 bg-gray-50/80 border border-gray-200/50 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-300/50 transition-all duration-300 backdrop-blur-sm"
                              placeholder="Full Name"
                              whileFocus={{ scale: 1.01 }}
                            />
                            <motion.div
                              className="absolute right-4 top-1/2 transform -translate-y-1/2"
                              whileHover={{ scale: 1.1 }}
                            >
                              <User className="w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors duration-300" />
                            </motion.div>
                          </div>
                        </label>
                      </motion.div>

                      <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6" variants={itemVariants}>
                        <div className="space-y-2">
                          <label className="block">
                            <div className="relative group">
                              <motion.input
                                name="email"
                                required
                                type="email"
                                autoComplete="email"
                                className="w-full px-4 lg:px-5 py-4 lg:py-5 bg-gray-50/80 border border-gray-200/50 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-300/50 transition-all duration-300 backdrop-blur-sm"
                                placeholder="Email"
                                whileFocus={{ scale: 1.01 }}
                              />
                              <motion.div
                                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors duration-300" />
                              </motion.div>
                            </div>
                          </label>
                        </div>

                        <div className="space-y-2">
                          <label className="block">
                            <div className="relative group">
                              <motion.input
                                name="mobile"
                                required
                                autoComplete="tel"
                                className="w-full px-4 lg:px-5 py-4 lg:py-5 bg-gray-50/80 border border-gray-200/50 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-300/50 transition-all duration-300 backdrop-blur-sm"
                                placeholder="Mobile"
                                whileFocus={{ scale: 1.01 }}
                              />
                              <motion.div
                                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Phone className="w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors duration-300" />
                              </motion.div>
                            </div>
                          </label>
                        </div>
                      </motion.div>

                      <motion.div className="space-y-2" variants={itemVariants}>
                        <label className="block">
                          <div className="relative group">
                            <motion.input
                              name="password"
                              required
                              type="password"
                              autoComplete="new-password"
                              className="w-full px-4 lg:px-5 py-4 lg:py-5 bg-gray-50/80 border border-gray-200/50 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-300/50 transition-all duration-300 backdrop-blur-sm"
                              placeholder="Password (min 6 characters)"
                              whileFocus={{ scale: 1.01 }}
                            />
                            <motion.div
                              className="absolute right-4 top-1/2 transform -translate-y-1/2"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors duration-300" />
                            </motion.div>
                          </div>
                        </label>
                      </motion.div>

                      <motion.button
                        disabled={loading}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-4 lg:py-5 px-6 lg:px-8 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-red-500/25 hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-3 backdrop-blur-sm"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        variants={itemVariants}
                      >
                        <BadgeCheck className="w-5 h-5" />
                        {loading ? "Creating your account..." : "Join AnaChat"}
                      </motion.button>
                    </motion.form>

                    {showGoogleSection && (
                      <motion.div
                        className="mt-8 lg:mt-10"
                        variants={itemVariants}
                      >
                        <div className="relative mb-6 lg:mb-8">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200/50"></div>
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
                          </div>
                        </div>

                        <motion.div
                          className="space-y-4"
                          whileHover={{ scale: 1.01 }}
                          transition={{ duration: 0.2 }}
                        >
                          {!googleClientId ? (
                            <div className="p-4 lg:p-5 bg-red-50/80 border border-red-200/50 rounded-2xl backdrop-blur-sm">
                              <p className="text-sm lg:text-base text-red-700">
                                Google OAuth not configured. Add VITE_GOOGLE_CLIENT_ID to environment.
                              </p>
                            </div>
                          ) : googleLoadError ? (
                            <div className="p-4 lg:p-5 bg-red-50/80 border border-red-200/50 rounded-2xl backdrop-blur-sm">
                              <p className="text-sm lg:text-base text-red-700">
                                Failed to load Google sign-in. Check network connection.
                              </p>
                            </div>
                          ) : !googleReady ? (
                            <div className="p-4 lg:p-5 bg-gray-50/80 border border-gray-200/50 rounded-2xl backdrop-blur-sm">
                              <p className="text-sm lg:text-base text-gray-600">Loading Google sign-in...</p>
                            </div>
                          ) : (
                            <motion.div
                              ref={googleButtonRef}
                              className="flex justify-center p-2"
                              whileHover={{ scale: 1.02 }}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="mt-8 lg:mt-10 text-center"
                variants={itemVariants}
              >
                <motion.button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                  className="text-sm lg:text-base text-gray-600 hover:text-gray-900 font-medium transition-colors duration-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {mode === "login" ? "New to AnaChat? Create account" : "Already have an account? Login"}
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

