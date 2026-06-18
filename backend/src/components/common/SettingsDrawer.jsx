import { useEffect, useState } from "react";
import { Lock, Settings2, Sparkles, X } from "lucide-react";
import ThemeColorModal from "./ThemeColorModal";
import ThemeDoodleModal from "./ThemeDoodleModal";
import { api } from "../../api/client";

const DEFAULT_SETTINGS = {
  compactMode: true,
  showOnlineStatus: true,
  enterToSend: true,
  soundEffects: true,
  notificationsEnabled: true
};

export default function SettingsDrawer({
  open,
  onClose,
  currentSettings,
  onSave,
  saving,
  anaSecurityPinEnabled,
  onSecurityUpdated,
  theme,
  onToggleTheme,
  doodleStyle,
  onSetDoodleStyle,
  accentColor,
  onSetAccentColor,
  onSetSidebarColor,
  onSetChatPaneColor
}) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [themeColorOpen, setThemeColorOpen] = useState(false);
  const [doodleOpen, setDoodleOpen] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");

  useEffect(() => {
    if (!open) return;
    setSettings({
      ...DEFAULT_SETTINGS,
      ...(currentSettings || {})
    });
  }, [open, currentSettings]);

  useEffect(() => {
    if (!open) setThemeColorOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) setDoodleOpen(false);
  }, [open]);

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    await onSave?.(settings);
  }

  async function enableOrChangePin() {
    setPinError("");
    setPinSuccess("");
    const nextPin = (pin || "").trim();
    const nextConfirm = (confirmPin || "").trim();
    const current = (currentPin || "").trim();

    if (!/^[0-9]{4,8}$/.test(nextPin)) {
      setPinError("PIN must be 4-8 digits.");
      return;
    }
    if (nextPin !== nextConfirm) {
      setPinError("PINs do not match.");
      return;
    }
    if (anaSecurityPinEnabled && !/^[0-9]{4,8}$/.test(current)) {
      setPinError("Current PIN is required to change PIN.");
      return;
    }

    setPinBusy(true);
    try {
      await api.post("/users/me/security-pin", {
        pin: nextPin,
        ...(anaSecurityPinEnabled ? { currentPin: current } : null)
      });
      setPin("");
      setConfirmPin("");
      setCurrentPin("");
      setPinSuccess(anaSecurityPinEnabled ? "PIN updated." : "Ana Security enabled.");
      await onSecurityUpdated?.();
    } catch (err) {
      setPinError(err.response?.data?.message || "Unable to update PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  async function disablePin() {
    setPinError("");
    setPinSuccess("");
    const current = (currentPin || "").trim();
    if (!/^[0-9]{4,8}$/.test(current)) {
      setPinError("Current PIN is required to disable.");
      return;
    }

    setPinBusy(true);
    try {
      await api.delete("/users/me/security-pin", { data: { currentPin: current } });
      setPin("");
      setConfirmPin("");
      setCurrentPin("");
      setPinSuccess("Ana Security disabled.");
      await onSecurityUpdated?.();
    } catch (err) {
      setPinError(err.response?.data?.message || "Unable to disable PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-[75] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-slate-900/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`absolute right-0 top-0 flex h-[100dvh] w-full max-w-[420px] flex-col border-l border-slate-200 bg-white p-4 shadow-xl transition-transform sm:p-5 dark:border-slate-800 dark:bg-slate-950 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Settings drawer"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Settings2 size={18} />
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close settings drawer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Appearance</p>
              <ToggleRow
                label="Dark mode"
                description="Switch between dark and light theme."
                checked={(theme || "dark") === "dark"}
                onChange={() => onToggleTheme?.()}
              />
              <button
                type="button"
                onClick={() => setThemeColorOpen(true)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <span>
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">App theme color</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Choose the primary accent color.</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded-full border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: "var(--accent)" }}
                    aria-hidden
                  />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customize</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDoodleOpen(true)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Sparkles size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">Chat doodles</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">Background pattern for message area.</span>
                  </span>
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Change</span>
              </button>
            </section>

            <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Chat preferences</p>

              <ToggleRow
                label="Compact layout"
                description="Reduce spacing in chat and sidebar."
                checked={settings.compactMode}
                onChange={(value) => updateSetting("compactMode", value)}
              />
              <ToggleRow
                label="Show online status"
                description="Display online / last seen under contact name."
                checked={settings.showOnlineStatus}
                onChange={(value) => updateSetting("showOnlineStatus", value)}
              />
              <ToggleRow
                label="Enter to send"
                description="Press Enter key to send message quickly."
                checked={settings.enterToSend}
                onChange={(value) => updateSetting("enterToSend", value)}
              />
              <ToggleRow
                label="Notifications"
                description="Enable app/browser notifications."
                checked={settings.notificationsEnabled}
                onChange={(value) => updateSetting("notificationsEnabled", value)}
              />
              <ToggleRow
                label="Sound effects"
                description="Play sound for messages, calls and alerts."
                checked={settings.soundEffects}
                onChange={(value) => updateSetting("soundEffects", value)}
              />
            </section>

            <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ana Security</p>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        <Lock size={15} />
                      </span>
                      Device PIN
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      When you login from a new device, you will be asked for this PIN.
                    </p>
                  </div>
                  <span
                    className={[
                      "mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      anaSecurityPinEnabled
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                        : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    ].join(" ")}
                  >
                    {anaSecurityPinEnabled ? "Enabled" : "Off"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  {anaSecurityPinEnabled ? (
                    <input
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Current PIN"
                      type="password"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100"
                    />
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      inputMode="numeric"
                      autoComplete="new-password"
                      placeholder={anaSecurityPinEnabled ? "New PIN" : "Set PIN"}
                      type="password"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100"
                    />
                    <input
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      inputMode="numeric"
                      autoComplete="new-password"
                      placeholder="Confirm PIN"
                      type="password"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100"
                    />
                  </div>

                  {pinError ? <p className="text-xs text-rose-600 dark:text-rose-400">{pinError}</p> : null}
                  {pinSuccess ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{pinSuccess}</p> : null}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={enableOrChangePin}
                      disabled={pinBusy}
                      className="btn-primary rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60"
                    >
                      {anaSecurityPinEnabled ? "Change PIN" : "Enable PIN"}
                    </button>
                    {anaSecurityPinEnabled ? (
                      <button
                        type="button"
                        onClick={disablePin}
                        disabled={pinBusy}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Disable
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>
      </aside>

      <ThemeColorModal
        open={themeColorOpen}
        onClose={() => setThemeColorOpen(false)}
        accentColor={accentColor}
        onSetAccentColor={onSetAccentColor}
        onSetSidebarColor={onSetSidebarColor}
        onSetChatPaneColor={onSetChatPaneColor}
      />

      <ThemeDoodleModal
        open={doodleOpen}
        onClose={() => setDoodleOpen(false)}
        doodleStyle={doodleStyle}
        onSetDoodleStyle={onSetDoodleStyle}
      />
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  const activeStyle = checked ? { backgroundColor: "var(--accent)" } : undefined;
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
      <span>
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange?.(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-10 items-center rounded-full transition ${
          checked ? "" : "bg-slate-300 dark:bg-slate-600"
        }`}
        style={activeStyle}
        aria-pressed={checked}
        aria-label={label}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
