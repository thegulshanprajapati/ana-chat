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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 relative overflow-hidden select-none">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] animate-pulse duration-3000 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center">
          {/* Pulsing Spinner Icon */}
          <div className="relative mb-8 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 border-r-indigo-500 animate-spin" />
            <div className="absolute w-10 h-10 rounded-full bg-violet-500/10 blur-md animate-ping" />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-300 to-violet-400">
            AnaChat
          </h1>
          <p className="mt-4 text-slate-300 text-base font-medium">
            Igniting your next great conversation...
          </p>
          <p className="mt-2 text-slate-500 text-xs">
            Please hold on while we get your experience ready.
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
