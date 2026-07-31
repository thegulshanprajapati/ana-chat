import { useEffect, useState, useRef } from "react";
import { Laptop, Smartphone, X, CheckCircle, AlertCircle, Loader2, LogOut, Key, Link2, RefreshCw } from "lucide-react";
import { api } from "../../api/client";

function getDeviceDetails(ua) {
  const lowercase = (ua || "").toLowerCase();
  let name = "Web Browser";
  let platform = "Platform";

  if (lowercase.includes("windows")) platform = "Windows";
  else if (lowercase.includes("macintosh") || lowercase.includes("mac os")) platform = "macOS";
  else if (lowercase.includes("linux")) platform = "Linux";
  else if (lowercase.includes("android")) platform = "Android";
  else if (lowercase.includes("iphone") || lowercase.includes("ipad")) platform = "iOS";

  if (lowercase.includes("electron") || lowercase.includes("exe")) {
    name = "Ana Desktop App";
  } else if (lowercase.includes("apk") || lowercase.includes("androidapp")) {
    name = "Ana Mobile App";
  } else if (lowercase.includes("chrome")) {
    name = "Google Chrome";
  } else if (lowercase.includes("firefox")) {
    name = "Mozilla Firefox";
  } else if (lowercase.includes("safari") && !lowercase.includes("chrome")) {
    name = "Apple Safari";
  } else if (lowercase.includes("edge")) {
    name = "Microsoft Edge";
  }

  return { name, platform };
}

export default function WhatsAppModal({ open, onClose }) {
  const [status, setStatus] = useState("list"); // list, generate_code, enter_code, success
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pairingCode, setPairingCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [submittingCode, setSubmittingCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const pollTimerRef = useRef(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/auth/devices");
      setDevices(data.activeSessions || []);
    } catch (err) {
      console.error("Error fetching devices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    fetchDevices();
    setStatus("list");
    setPairingCode("");
    setInputCode("");
    setErrorMsg("");
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleRevoke = async (sessionId) => {
    try {
      await api.post("/auth/devices/self-revoke", { sessionId });
      setDevices((prev) => prev.filter((d) => d.id !== sessionId));
    } catch (err) {
      console.error("Error revoking session:", err);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm("Are you sure you want to log out of all other devices?")) return;
    try {
      setLoading(true);
      await api.post("/auth/devices/self-revoke-all", { deleteChats: false });
      onClose?.();
      window.location.reload();
    } catch (err) {
      console.error("Error revoking all sessions:", err);
      setLoading(false);
    }
  };

  const handleStartGenerateCode = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const { data } = await api.post("/auth/devices/pairing-code");
      setPairingCode(data.code);
      setStatus("generate_code");

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await api.get(`/auth/devices/pairing-status/${data.code}`);
          if (statusRes.data.status === "authorized") {
            clearInterval(pollTimerRef.current);
            setStatus("success");
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          }
        } catch (err) {
          console.error("Pairing polling error:", err);
        }
      }, 2000);

    } catch (err) {
      setErrorMsg("Failed to generate pairing code.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeCodeSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = inputCode.trim().toUpperCase();
    if (!cleanCode) return;

    try {
      setSubmittingCode(true);
      setErrorMsg("");
      await api.post("/auth/devices/authorize-code", { code: cleanCode });
      setStatus("success");
      setTimeout(() => {
        fetchDevices();
        setStatus("list");
      }, 1500);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Invalid or expired pairing code.");
    } finally {
      setSubmittingCode(false);
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
        className="relative w-full max-w-[460px] overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl transition dark:border-slate-800 dark:bg-slate-950/95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Laptop size={16} className="text-violet-500" />
            Ana Linked Devices
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
        <div className="flex flex-col p-6">
          {loading && status === "list" ? (
            <div className="my-10 flex flex-col items-center gap-3">
              <Loader2 size={36} className="animate-spin text-violet-500" />
              <p className="text-sm font-medium text-slate-500">Loading linked devices...</p>
            </div>
          ) : (
            <div className="w-full space-y-4">
              {/* SUCCESS VIEW */}
              {status === "success" && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center animate-pulse">
                  <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
                  <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-400">Device Authorization Successful</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Your session has been securely established. Synchronizing data...
                  </p>
                </div>
              )}

              {/* LIST VIEW */}
              {status === "list" && (
                <>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto no-scrollbar">
                    {devices.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                        <Laptop size={32} className="mx-auto text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No other devices linked</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Link a new device to access Ana Chat on Web or Desktop.
                        </p>
                      </div>
                    ) : (
                      devices.map((session) => {
                        const { name, platform } = getDeviceDetails(session.user_agent);
                        const isMobile = name.includes("Mobile");
                        return (
                          <div key={session.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/40">
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 dark:bg-violet-500/20">
                                {isMobile ? <Smartphone size={18} /> : <Laptop size={18} />}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{name}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  {platform} • {session.ip_address || "Unknown IP"}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRevoke(session.id)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-rose-500/10 text-rose-500 transition active:scale-95"
                              title="Log out device"
                            >
                              <LogOut size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-2 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStatus("enter_code")}
                      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 py-2.5 text-xs font-bold transition dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white"
                    >
                      Authorize Code
                    </button>
                    <button
                      type="button"
                      onClick={handleStartGenerateCode}
                      className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-2.5 text-xs font-bold transition"
                    >
                      Generate Code
                    </button>
                  </div>

                  {devices.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRevokeAll}
                      className="w-full rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 py-2 text-xs font-bold transition"
                    >
                      Log Out All Devices
                    </button>
                  )}
                </>
              )}

              {/* GENERATE CODE VIEW */}
              {status === "generate_code" && (
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-950/40 dark:bg-violet-950/20">
                    <Key size={32} className="text-violet-500 mx-auto mb-2 animate-bounce" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">New Device Pairing Code</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto mt-0.5">
                      Enter this code on your logged-in device to authorize this browser/app session.
                    </p>
                  </div>

                  <div className="px-6 py-3 bg-slate-100 dark:bg-slate-900 rounded-xl font-mono text-2xl font-bold tracking-[0.2em] text-violet-600 dark:text-violet-400 select-all border border-black/5 dark:border-white/5">
                    {pairingCode}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <RefreshCw size={10} className="animate-spin text-violet-500" />
                    Waiting for authorization...
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                      setStatus("list");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 py-2 text-xs font-bold transition dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white"
                  >
                    Go Back
                  </button>
                </div>
              )}

              {/* ENTER CODE VIEW */}
              {status === "enter_code" && (
                <form onSubmit={handleAuthorizeCodeSubmit} className="space-y-4">
                  <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-950/40 dark:bg-violet-950/20 text-center">
                    <Link2 size={32} className="text-violet-500 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Link with Code</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto mt-0.5">
                      Type the alphanumeric code shown on the screen of the device you want to link.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <input
                      type="text"
                      maxLength={9}
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value)}
                      placeholder="ABCD-EFGH"
                      className="w-full text-center py-2.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 outline-none text-base font-bold font-mono tracking-wider focus:border-violet-500/60 uppercase transition"
                    />
                    {errorMsg && (
                      <p className="text-[10px] text-rose-500 font-semibold text-center mt-1">
                        {errorMsg}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setStatus("list")}
                      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 py-2.5 text-xs font-bold transition dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingCode || !inputCode.trim()}
                      className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      {submittingCode && <Loader2 size={12} className="animate-spin" />}
                      Link Device
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
