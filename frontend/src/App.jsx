import AuthPage from "./components/AuthPage";
import ChatPage from "./pages/ChatPage";
import AdminPortal from "./components/AdminPortal";
import ReactionMockup from "./pages/ReactionMockup";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ThemeProvider } from "./context/ThemeContext";
import useDisableDevtools from "./hooks/useDisableDevtools";
import AppErrorBoundary from "./components/common/AppErrorBoundary";
import GlobalErrorOverlay from "./components/common/GlobalErrorOverlay";
import { isPathWithBase } from "./utils/nav";

function UserApp() {
  const { user, reload, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-slate-500 dark:text-slate-200">
        <div className="text-2xl font-bold">AnaChat is igniting your next great conversation...</div>
        <div className="mt-2 text-sm text-slate-400">Please hold on while we get your experience ready.</div>
      </div>
    );
  }

  if (!user) return <AuthPage onAuthed={reload} />;
  return <ChatPage />;
}

export default function App() {
  const isAdminRoute = isPathWithBase("admin");
  const isReactionMockRoute = isPathWithBase("mockups/reaction");
  const disableDevtools = import.meta.env.PROD && import.meta.env.VITE_DISABLE_DEVTOOLS === "true";

  useDisableDevtools(disableDevtools);

  return (
    <ThemeProvider>
      <GlobalErrorOverlay />
      <AppErrorBoundary>
        {isReactionMockRoute ? (
          <ReactionMockup />
        ) : isAdminRoute ? (
          <AdminPortal />
        ) : (
          <AuthProvider>
            <SocketProvider>
              <UserApp />
            </SocketProvider>
          </AuthProvider>
        )}
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
