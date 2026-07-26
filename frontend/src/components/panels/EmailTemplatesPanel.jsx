import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail, Save, Send, Eye, Smartphone, Monitor, Moon,
  ChevronDown, RefreshCw, CheckCircle2, X, AlertCircle,
  Settings, Palette, Type, Code, Zap, FileText
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const TEMPLATE_VARIABLES = [
  { key: "user_name", desc: "Recipient's display name" },
  { key: "user_email", desc: "Recipient's email address" },
  { key: "reset_link", desc: "Password reset URL" },
  { key: "expiry_time", desc: "Link expiry duration" },
  { key: "support_email", desc: "Support email address" },
  { key: "brand_name", desc: "Your brand name" },
  { key: "company_name", desc: "Your company name" },
  { key: "current_year", desc: "Current year" },
  { key: "logo", desc: "Brand logo URL" },
  { key: "button_color", desc: "CTA button color" },
  { key: "website", desc: "Main website URL" }
];

const ENCRYPTION_OPTS = ["tls", "ssl", "none"];
const PROVIDER_OPTS = ["smtp", "resend"];

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
      type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function VariablePicker({ onInsert }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
      >
        <Zap className="h-3.5 w-3.5 text-amber-500" />
        Insert Variable
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">Available Variables</p>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {TEMPLATE_VARIABLES.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => { onInsert(`{{${v.key}}}`); setOpen(false); }}
                className="w-full text-left flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
              >
                <code className="text-xs font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded shrink-0">
                  {`{{${v.key}}}`}
                </code>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{v.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LivePreview({ html, variables, previewMode }) {
  const renderedHtml = (html || "").replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const sampleVars = {
      user_name: "John Doe",
      user_email: "john@example.com",
      reset_link: "https://chat.myana.site/reset-password?token=sample",
      expiry_time: "15 minutes",
      support_email: variables.support_email || "support@myana.site",
      brand_name: "AnaChat",
      company_name: "AnaChat",
      current_year: new Date().getFullYear(),
      logo: variables.logo_url || "",
      button_color: variables.button_color || "#e11d48",
      website: "https://chat.myana.site"
    };
    return sampleVars[key] || `{{${key}}}`;
  });

  const widths = { desktop: "100%", mobile: "375px" };
  const bgClass = previewMode === "dark" ? "bg-gray-900" : "bg-slate-100";
  const width = widths[previewMode] || widths.desktop;

  return (
    <div className={`rounded-xl ${bgClass} p-4 border border-slate-200 dark:border-slate-700 overflow-auto min-h-[400px] flex items-start justify-center transition-all`}>
      <div style={{ width, maxWidth: "100%" }}>
        <iframe
          title="Email Preview"
          srcDoc={`<!DOCTYPE html><html><body style="margin:0;font-family:sans-serif;background:${previewMode === "dark" ? "#111827" : "#fff"}">${renderedHtml}</body></html>`}
          className="w-full rounded-lg"
          style={{ minHeight: 400, border: "none" }}
        />
      </div>
    </div>
  );
}

function EmailSettingsTab({ adminToken }) {
  const [settings, setSettings] = useState({
    provider: "smtp", smtp_host: "", smtp_port: 587, smtp_user: "",
    smtp_pass: "", smtp_encryption: "tls", sender_email: "",
    sender_name: "AnaChat", reply_to: "", resend_api_key: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch(`${API}/admin/email-settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      credentials: "include"
    })
      .then(r => r.json())
      .then(d => { if (d.settings) setSettings(s => ({ ...s, ...d.settings })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminToken]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/email-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        credentials: "include",
        body: JSON.stringify(settings)
      });
      const d = await r.json();
      if (r.ok) {
        setToast({ msg: "Email settings saved!", type: "success" });
      } else {
        setToast({ msg: d.message || "Failed to save settings", type: "error" });
      }
    } catch {
      setToast({ msg: "Network error", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Email Provider</label>
        <div className="flex gap-2">
          {PROVIDER_OPTS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setSettings(s => ({ ...s, provider: p }))}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                settings.provider === p
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                  : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {p === "smtp" ? "SMTP" : "Resend API"}
            </button>
          ))}
        </div>
      </div>

      {settings.provider === "smtp" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "SMTP Host", key: "smtp_host", type: "text", placeholder: "smtp.gmail.com" },
            { label: "SMTP Port", key: "smtp_port", type: "number", placeholder: "587" },
            { label: "SMTP Username", key: "smtp_user", type: "text", placeholder: "user@gmail.com" },
            { label: "SMTP Password", key: "smtp_pass", type: "password", placeholder: "App password" },
            { label: "Sender Email", key: "sender_email", type: "email", placeholder: "noreply@myana.site" },
            { label: "Sender Name", key: "sender_name", type: "text", placeholder: "AnaChat" },
            { label: "Reply-To", key: "reply_to", type: "email", placeholder: "support@myana.site" }
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{f.label}</label>
              <input
                type={f.type}
                value={settings[f.key] || ""}
                onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Encryption</label>
            <select
              value={settings.smtp_encryption || "tls"}
              onChange={e => setSettings(s => ({ ...s, smtp_encryption: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
            >
              {ENCRYPTION_OPTS.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Resend API Key</label>
          <input
            type="password"
            value={settings.resend_api_key || ""}
            onChange={e => setSettings(s => ({ ...s, resend_api_key: e.target.value }))}
            placeholder="re_..."
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
          />
          <p className="mt-2 text-xs text-slate-400">Get your API key from <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:underline">resend.com</a></p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/25 hover:shadow-rose-500/40 disabled:opacity-60 transition-all"
      >
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}

export default function EmailTemplatesPanel({ adminToken }) {
  const [templates, setTemplates] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [activeTab, setActiveTab] = useState("html"); // html | plain | style | settings
  const [toast, setToast] = useState(null);
  const htmlRef = useRef(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // Load all templates
  useEffect(() => {
    fetch(`${API}/admin/email-templates`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      credentials: "include"
    })
      .then(r => r.json())
      .then(d => {
        setTemplates(d.templates || []);
        if (d.templates?.length) setSelectedKey(d.templates[0].template_key);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminToken]);

  // Load selected template
  useEffect(() => {
    if (!selectedKey) return;
    fetch(`${API}/admin/email-templates/${selectedKey}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      credentials: "include"
    })
      .then(r => r.json())
      .then(d => setTemplate(d.template || null))
      .catch(() => {});
  }, [selectedKey, adminToken]);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/email-templates/${selectedKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        credentials: "include",
        body: JSON.stringify(template)
      });
      const d = await r.json();
      if (r.ok) {
        setTemplate(d.template);
        showToast("Template saved successfully!");
      } else {
        showToast(d.message || "Failed to save template", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/admin/email-templates/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        credentials: "include",
        body: JSON.stringify({ to: testEmail, template_key: selectedKey })
      });
      const d = await r.json();
      if (r.ok) showToast(`Test email sent to ${testEmail}`);
      else showToast(d.message || "Failed to send test email", "error");
    } catch {
      showToast("Network error", "error");
    } finally {
      setSending(false);
    }
  };

  const insertVariable = useCallback((variable) => {
    if (activeTab === "html") {
      const textarea = htmlRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = template?.html_content || "";
      const newHtml = current.substring(0, start) + variable + current.substring(end);
      setTemplate(t => ({ ...t, html_content: newHtml }));
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    } else {
      setTemplate(t => ({ ...t, plain_text: (t?.plain_text || "") + variable }));
    }
  }, [activeTab, template]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-0">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-rose-500" />
            Email Templates
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Customize all outgoing emails from one place
          </p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Template list sidebar */}
        <div className="w-56 shrink-0 flex flex-col gap-1">
          {templates.map(t => (
            <button
              key={t.template_key}
              type="button"
              onClick={() => setSelectedKey(t.template_key)}
              className={`w-full text-left rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                selectedKey === t.template_key
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <div className="font-semibold truncate">{t.name}</div>
              <div className={`text-xs mt-0.5 truncate ${selectedKey === t.template_key ? "text-rose-100" : "text-slate-400"}`}>
                {t.template_key}
              </div>
            </button>
          ))}

          {/* Settings link */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSelectedKey("__settings")}
              className={`w-full text-left rounded-xl px-3 py-2.5 text-sm font-medium transition flex items-center gap-2 ${
                selectedKey === "__settings"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Settings className="h-4 w-4" />
              Email Settings
            </button>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedKey === "__settings" ? (
            <EmailSettingsTab adminToken={adminToken} />
          ) : template ? (
            <div className="space-y-4">
              {/* Subject + metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={template.subject || ""}
                    onChange={e => setTemplate(t => ({ ...t, subject: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                    placeholder="Email subject..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Sender Name</label>
                  <input
                    type="text"
                    value={template.sender_name || ""}
                    onChange={e => setTemplate(t => ({ ...t, sender_name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                    placeholder="AnaChat"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Reply-To Email</label>
                  <input
                    type="email"
                    value={template.reply_to || ""}
                    onChange={e => setTemplate(t => ({ ...t, reply_to: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                    placeholder="support@myana.site"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Support Email</label>
                  <input
                    type="email"
                    value={template.support_email || ""}
                    onChange={e => setTemplate(t => ({ ...t, support_email: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                    placeholder="support@myana.site"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-0">
                {[
                  { id: "html", icon: <Code className="h-3.5 w-3.5" />, label: "HTML" },
                  { id: "plain", icon: <FileText className="h-3.5 w-3.5" />, label: "Plain Text" },
                  { id: "style", icon: <Palette className="h-3.5 w-3.5" />, label: "Style" },
                  { id: "preview", icon: <Eye className="h-3.5 w-3.5" />, label: "Preview" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition -mb-px border-b-2 ${
                      activeTab === tab.id
                        ? "border-rose-500 text-rose-600 dark:text-rose-400"
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}

                <div className="ml-auto"><VariablePicker onInsert={insertVariable} /></div>
              </div>

              {/* HTML editor */}
              {activeTab === "html" && (
                <textarea
                  ref={htmlRef}
                  value={template.html_content || ""}
                  onChange={e => setTemplate(t => ({ ...t, html_content: e.target.value }))}
                  className="w-full h-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-y transition"
                  spellCheck={false}
                  placeholder="<div>Your email HTML here...</div>"
                />
              )}

              {/* Plain text editor */}
              {activeTab === "plain" && (
                <textarea
                  value={template.plain_text || ""}
                  onChange={e => setTemplate(t => ({ ...t, plain_text: e.target.value }))}
                  className="w-full h-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-y transition"
                  placeholder="Plain text version of the email..."
                />
              )}

              {/* Style editor */}
              {activeTab === "style" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Button Color", key: "button_color" },
                    { label: "Brand Color", key: "brand_color" },
                    { label: "Background Color", key: "bg_color" }
                  ].map(s => (
                    <div key={s.key}>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">{s.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={template[s.key] || "#e11d48"}
                          onChange={e => setTemplate(t => ({ ...t, [s.key]: e.target.value }))}
                          className="h-9 w-12 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={template[s.key] || ""}
                          onChange={e => setTemplate(t => ({ ...t, [s.key]: e.target.value }))}
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="col-span-full">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Logo URL</label>
                    <input
                      type="url"
                      value={template.logo_url || ""}
                      onChange={e => setTemplate(t => ({ ...t, logo_url: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}

              {/* Preview */}
              {activeTab === "preview" && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Preview Mode:</span>
                    {[
                      { id: "desktop", icon: <Monitor className="h-4 w-4" />, label: "Desktop" },
                      { id: "mobile", icon: <Smartphone className="h-4 w-4" />, label: "Mobile" },
                      { id: "dark", icon: <Moon className="h-4 w-4" />, label: "Dark" }
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPreviewMode(m.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          previewMode === m.id
                            ? "bg-rose-500 text-white shadow-md"
                            : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        {m.icon}{m.label}
                      </button>
                    ))}
                  </div>
                  <LivePreview
                    html={template.html_content}
                    variables={template}
                    previewMode={previewMode}
                  />
                </div>
              )}

              {/* Actions bar */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/20 hover:shadow-rose-500/35 disabled:opacity-60 transition-all"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save Template"}
                </button>

                {/* Test Email section */}
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    placeholder="test@email.com"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 w-48 transition"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={sending || !testEmail}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-700 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 transition"
                  >
                    {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Sending…" : "Send Test"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Select a template to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
