import { useEffect } from "react";
import AuthPage from "./components/AuthPage";
import ChatPage from "./pages/ChatPage";
import AdminPortal from "./components/AdminPortal";
import ReactionMockup from "./pages/ReactionMockup";
import SpeedInsightsInjector from "./components/SpeedInsights";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContextNew";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { OfflineQueueProvider } from "./context/OfflineQueueContext";
import { ConnectionBanner } from "./components/common/SocketStatusIndicator";
import useDisableDevtools from "./hooks/useDisableDevtools";
import AppErrorBoundary from "./components/common/AppErrorBoundary";
import GlobalErrorOverlay from "./components/common/GlobalErrorOverlay";
import { isPathWithBase } from "./utils/nav";

function UserApp() {
  const { user, reload, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-white to-pink-50 relative overflow-hidden select-none">
        {/* Ambient floating orbs */}
        <div className="absolute -top-24 -left-24 w-[420px] h-[420px] bg-rose-200/40 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-[380px] h-[380px] bg-pink-200/35 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] bg-rose-100/30 rounded-full blur-[140px] pointer-events-none" />

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center gap-5 text-center px-6">

          {/* Animated logo */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-28 h-28 rounded-full bg-rose-400/15 animate-ping" style={{ animationDuration: "2.4s" }} />
            <div className="absolute w-22 h-22 rounded-full bg-rose-300/20 animate-ping" style={{ animationDuration: "2.9s", animationDelay: "0.5s" }} />
            <div className="relative w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-rose-500 to-pink-600 shadow-[0_16px_48px_rgba(225,29,72,0.38)] flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M7 9a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-6.5L12 31v-6H11a4 4 0 0 1-4-4V9z" fill="white" fillOpacity="0.95"/>
                <rect x="11.5" y="13" width="13" height="2" rx="1" fill="rgba(225,29,72,0.55)"/>
                <rect x="11.5" y="17.5" width="9" height="2" rx="1" fill="rgba(225,29,72,0.35)"/>
              </svg>
            </div>
          </div>

          {/* Brand */}
          <div className="space-y-1.5">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Ana<span className="text-rose-600">Chat</span>
            </h1>
            <p className="text-[15px] font-medium text-slate-500">
              Where conversations come alive
            </p>
          </div>

          {/* Bouncing dots */}
          <div className="flex items-center gap-2 mt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "0.9s" }} />
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "0.9s" }} />
            <span className="h-2.5 w-2.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "0.9s" }} />
          </div>

          <p className="text-xs text-slate-400">
            Getting your experience ready...
          </p>
        </div>

        {/* Bottom badge */}
        <div className="absolute bottom-6 text-center">
          <p className="text-[11px] text-slate-300 font-medium tracking-wide">
            🔒 End-to-end encrypted · Private by design
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage onAuthed={reload} />;
  return (
    <>
      <ConnectionBanner />
      <ChatPage />
    </>
  );
}

export default function App() {
  const isAdminRoute = isPathWithBase("admin");
  const isReactionMockRoute = isPathWithBase("mockups/reaction");
  const disableDevtools = import.meta.env.PROD && import.meta.env.VITE_DISABLE_DEVTOOLS === "true";

  useDisableDevtools(disableDevtools);

  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <SpeedInsightsInjector />
        <GlobalErrorOverlay />
        <AppErrorBoundary>
          {isReactionMockRoute ? (
            <ReactionMockup />
          ) : isAdminRoute ? (
            <AdminPortal />
          ) : (
            <AuthProvider>
              <OfflineQueueProvider>
                <SocketProvider>
                  <UserApp />
                </SocketProvider>
              </OfflineQueueProvider>
            </AuthProvider>
          )}
        </AppErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  );
}
