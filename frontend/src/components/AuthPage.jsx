import { useCallback, useEffect, useRef, useState } from "react";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-100 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-200 rounded-full opacity-30 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-50 rounded-full opacity-10 blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="hidden lg:block space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-100 rounded-full">
                <ShieldCheck className="w-5 h-5 text-red-600" />
                <span className="text-sm font-semibold text-red-700">AnaChat Secure</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                  Connect Instantly,<br />
                  <span className="text-red-600">Chat Securely</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  {mode === "login"
                    ? "Welcome back! Continue your conversations with end-to-end encryption."
                    : "Join thousands of users in secure, real-time messaging. Create your account today."}
                </p>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Lightning Fast</h3>
                    <p className="text-sm text-gray-600">Real-time messaging with instant delivery</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">End-to-End Security</h3>
                    <p className="text-sm text-gray-600">Your conversations are fully encrypted</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Group Conversations</h3>
                    <p className="text-sm text-gray-600">Create rooms and invite friends</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Indicator */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-red-500" />
                <span className="text-sm font-medium text-gray-700">
                  Trusted by thousands of users worldwide
                </span>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Card */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
              {/* Tabs */}
              <div className="flex rounded-xl bg-gray-50 p-1 mb-8">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    mode === "login"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    mode === "signup"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 text-xs">!</span>
                    </div>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {mode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block">
                      <div className="relative">
                        <input
                          name="email_or_mobile"
                          required
                          autoComplete="username"
                          className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                          placeholder="Email or Mobile"
                        />
                        <Mail className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      </div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="block">
                      <div className="relative">
                        <input
                          name="password"
                          required
                          type="password"
                          autoComplete="current-password"
                          className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                          placeholder="Password"
                        />
                        <Lock className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      </div>
                    </label>
                  </div>

                  <button
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-3"
                  >
                    <MessageCircle className="w-5 h-5" />
                    {loading ? "Signing you in..." : "Login to AnaChat"}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <form onSubmit={handleSignupForm} className="space-y-6">
                    <div className="space-y-2">
                      <label className="block">
                        <div className="relative">
                          <input
                            name="name"
                            required
                            autoComplete="name"
                            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                            placeholder="Full Name"
                          />
                          <User className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block">
                          <div className="relative">
                            <input
                              name="email"
                              required
                              type="email"
                              autoComplete="email"
                              className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                              placeholder="Email"
                            />
                            <Mail className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          </div>
                        </label>
                      </div>

                      <div className="space-y-2">
                        <label className="block">
                          <div className="relative">
                            <input
                              name="mobile"
                              required
                              autoComplete="tel"
                              className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                              placeholder="Mobile"
                            />
                            <Phone className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block">
                        <div className="relative">
                          <input
                            name="password"
                            required
                            type="password"
                            autoComplete="new-password"
                            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                            placeholder="Password (min 6 characters)"
                          />
                          <Lock className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                      </label>
                    </div>

                    <button
                      disabled={loading}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-3"
                    >
                      <BadgeCheck className="w-5 h-5" />
                      {loading ? "Creating your account..." : "Join AnaChat"}
                    </button>
                  </form>

                  {showGoogleSection && (
                    <div className="mt-8">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
                        </div>
                      </div>

                      <div className="mt-6">
                        {!googleClientId ? (
                          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-700">
                              Google OAuth not configured. Add VITE_GOOGLE_CLIENT_ID to environment.
                            </p>
                          </div>
                        ) : googleLoadError ? (
                          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-700">
                              Failed to load Google sign-in. Check network connection.
                            </p>
                          </div>
                        ) : !googleReady ? (
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                            <p className="text-sm text-gray-600">Loading Google sign-in...</p>
                          </div>
                        ) : (
                          <div ref={googleButtonRef} className="flex justify-center" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200"
                >
                  {mode === "login" ? "New to AnaChat? Create account" : "Already have an account? Login"}
                </button>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                AnaChat — secure messaging built for speed and privacy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
