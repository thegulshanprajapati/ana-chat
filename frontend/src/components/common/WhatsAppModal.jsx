import { useEffect, useState } from "react";
import { QrCode, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import { useSocket } from "../../context/SocketContextNew";

export default function WhatsAppModal({ open, onClose }) {
  const socket = useSocket();
  const [status, setStatus] = useState("disconnected");
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return undefined;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/whatsapp/status");
        setStatus(data.status);
        if (data.qr) {
          setQrCode(data.qr);
        }
      } catch (err) {
        console.error("Error fetching WhatsApp status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Listen to live events via Socket.IO
    const handleQR = (data) => {
      if (data.qr) {
        setQrCode(data.qr);
        setStatus("qr_ready");
      }
    };

    const handleStatus = (data) => {
      setStatus(data.status);
      if (data.status === "connected") {
        setQrCode(null);
      }
    };

    socket.on("whatsapp_qr", handleQR);
    socket.on("whatsapp_status", handleStatus);

    return () => {
      socket.off("whatsapp_qr", handleQR);
      socket.off("whatsapp_status", handleStatus);
    };
  }, [open, socket]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleConnect = async () => {
    try {
      setLoading(true);
      await api.post("/whatsapp/connect");
      setStatus("connecting");
    } catch (err) {
      console.error("Failed to start WhatsApp connection:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await api.post("/whatsapp/disconnect");
      setStatus("disconnected");
      setQrCode(null);
    } catch (err) {
      console.error("Failed to disconnect WhatsApp:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[440px] overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl transition dark:border-slate-800 dark:bg-slate-950/95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <QrCode size={16} className="text-emerald-500" />
            Ana Synchronization
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center justify-center p-6 text-center">
          {loading ? (
            <div className="my-10 flex flex-col items-center gap-3">
              <Loader2 size={36} className="animate-spin text-emerald-500" />
              <p className="text-sm font-medium text-slate-500">Checking connection state...</p>
            </div>
          ) : (
            <div className="w-full space-y-5">
              {status === "connected" && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
                  <CheckCircle size={42} className="mx-auto text-emerald-500 mb-3" />
                  <h4 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">Connected</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Your Ana session is active and synchronized. Conversations will stay synced in real-time.
                  </p>
                </div>
              )}

              {status === "connecting" && (
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 text-center">
                  <Loader2 size={42} className="mx-auto text-blue-500 mb-3 animate-spin" />
                  <h4 className="text-base font-semibold text-blue-800 dark:text-blue-400">Connecting</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Connecting to Ana servers. Please wait...
                  </p>
                </div>
              )}

              {status === "qr_ready" && qrCode && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-200">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-52 h-52" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Scan QR Code</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[280px] mx-auto">
                      Open WhatsApp on your phone, tap Menu or Settings, and select Linked Devices to scan the code.
                    </p>
                  </div>
                </div>
              )}

              {status === "disconnected" && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/50">
                  <AlertCircle size={42} className="mx-auto text-slate-400 mb-3" />
                  <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">Disconnected</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Ana synchronization is not active. Link a device to begin sync.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2">
                {status === "connected" ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-2.5 text-sm font-semibold transition"
                  >
                    Disconnect Device
                  </button>
                ) : status === "qr_ready" || status === "connecting" ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white py-2.5 text-sm font-semibold transition"
                  >
                    Cancel Connection
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-semibold transition"
                  >
                    Link Ana Device
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
