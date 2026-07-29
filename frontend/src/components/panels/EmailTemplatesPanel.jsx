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
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl border backdrop-blur-md ${
      type === "success" 
        ? "bg-emerald-950/95 text-emerald-200 border-emerald-500/30" 
        : "bg-rose-950/95 text-rose-200 border-rose-500/30"
    }`}>
      {type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-rose-400" />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function VariablePicker({ onInsert }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
      >
        <Zap className="h-3.5 w-3.5 text-amber-500" />
        Insert Variable
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1.5 w-64 rounded-xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
          <div className="p-2.5 border-b border-slate-900 bg-slate-900/50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Available Variables</p>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {TEMPLATE_VARIABLES.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => { onInsert(`{{${v.key}}}`); setOpen(false); }}
                className="w-full text-left flex flex-col gap-1 rounded-lg px-2.5 py-2 hover:bg-slate-900 transition group"
              >
                <code className="text-[11px] font-mono text-amber-400 bg-amber-950/20 px-1.5 py-0.5 rounded shrink-0 self-start">
                  {`{{${v.key}}}`}
                </code>
                <span className="text-[11px] text-slate-400 group-hover:text-slate-300 pl-0.5">{v.desc}</span>
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
  const bgClass = previewMode === "dark" ? "bg-slate-950" : "bg-slate-800";
  const width = widths[previewMode] || widths.desktop;

  return (
    <div className={`rounded-xl ${bgClass} p-4 border border-slate-850 overflow-auto min-h-[400px] flex items-start justify-center transition-all`}>
      <div style={{ width, maxWidth: "100%" }} className="transition-all duration-300">
        <iframe
          title="Email Preview"
          srcDoc={`<!DOCTYPE html><html><body style="margin:0;font-family:sans-serif;background:${previewMode === "dark" ? "#111827" : "#fff"}">${renderedHtml}</body></html>`}
          className="w-full rounded-lg bg-white shadow-lg"
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
        setToast({ msg: "Email settings saved successfully!", type: "success" });
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
        <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2.5">Email Provider</label>
        <div className="flex gap-2">
          {PROVIDER_OPTS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setSettings(s => ({ ...s, provider: p }))}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition duration-200 active:scale-[0.98] ${
                settings.provider === p
                  ? "bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 border-transparent shadow-lg shadow-amber-500/10"
                  : "border-slate-800 text-slate-400 hover:bg-slate-900"
              }`}
            >
              {p === "smtp" ? "SMTP Server" : "Resend API"}
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
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">{f.label}</label>
              <input
                type={f.type}
                value={settings[f.key] || ""}
                onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-650 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
              />
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Encryption</label>
            <select
              value={settings.smtp_encryption || "tls"}
              onChange={e => setSettings(s => ({ ...s, smtp_encryption: e.target.value }))}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
            >
              {ENCRYPTION_OPTS.map(o => <option key={o} value={o} className="bg-slate-950">{o.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Resend API Key</label>
          <input
            type="password"
            value={settings.resend_api_key || ""}
            onChange={e => setSettings(s => ({ ...s, resend_api_key: e.target.value }))}
            placeholder="re_..."
            className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-650 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
          />
          <p className="mt-2 text-[11px] text-slate-500">Get your API key from <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline font-semibold">resend.com</a></p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:from-amber-500 hover:to-yellow-500 shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}

export default function EmailTemplatesPanel({ adminToken, initialSelectedKey = null }) {
  const [templates, setTemplates] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [activeTab, setActiveTab] = useState("html"); // html | plain | style | preview
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
        if (initialSelectedKey) setSelectedKey(initialSelectedKey);
        else if (d.templates?.length) setSelectedKey(d.templates[0].template_key);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminToken, initialSelectedKey]);

  // Load selected template
  useEffect(() => {
    if (!selectedKey || selectedKey === "__settings") return;
    fetch(`${API}/admin/email-templates/${selectedKey}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      credentials: "include"
    })
      .then(r => r.json())
      .then(d => setTemplate(d.template || null))
      .catch(() => {});
  }, [selectedKey, adminToken]);

  // Watch for change in initialSelectedKey prop from parent tab switches
  useEffect(() => {
    if (initialSelectedKey) {
      setSelectedKey(initialSelectedKey);
    }
  }, [initialSelectedKey]);

  const handleSave = async () => {
    if (!template || selectedKey === "__settings") return;
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
    if (!testEmail || selectedKey === "__settings") return;
    setSending(true);
    try {
      const r = await fetch(`${API}/admin/email-templates/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        credentials: "include",
        body: JSON.stringify({ to: testEmail, template_key: selectedKey })
      });
      const d = await r.json();
      if (r.ok) showToast(`Test email sent successfully to ${testEmail}`);
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
        <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-0">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-800/40 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-50 flex items-center gap-2">
            {selectedKey === "__settings" ? (
              <>
                <Settings className="h-5 w-5 text-amber-500" />
                SMTP & Email Settings
              </>
            ) : (
              <>
                <Mail className="h-5 w-5 text-amber-500" />
                Email Templates
              </>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedKey === "__settings" 
              ? "Configure your server's SMTP and sender details" 
              : "Customize all outgoing system emails from one place"}
          </p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Template list sidebar */}
        {selectedKey !== "__settings" && (
          <div className="w-56 shrink-0 flex flex-col gap-1">
            {templates.map(t => (
              <button
                key={t.template_key}
                type="button"
                onClick={() => setSelectedKey(t.template_key)}
                className={`w-full text-left rounded-xl px-3 py-2.5 text-xs font-semibold border transition duration-200 ${
                  selectedKey === t.template_key
                    ? "bg-slate-800/90 text-slate-50 border-slate-700/50 shadow-md"
                    : "border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                }`}
              >
                <div className="truncate">{t.name}</div>
                <div className={`text-[10px] mt-0.5 truncate font-normal ${selectedKey === t.template_key ? "text-amber-400" : "text-slate-500"}`}>
                  {t.template_key}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedKey === "__settings" ? (
            <EmailSettingsTab adminToken={adminToken} />
          ) : template ? (
            <div className="space-y-4">
              {/* Subject + metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Subject Line</label>
                  <input
                    type="text"
                    value={template.subject || ""}
                    onChange={e => setTemplate(t => ({ ...t, subject: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-650 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="Email subject..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Sender Name</label>
                  <input
                    type="text"
                    value={template.sender_name || ""}
                    onChange={e => setTemplate(t => ({ ...t, sender_name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-650 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="AnaChat"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Reply-To Email</label>
                  <input
                    type="email"
                    value={template.reply_to || ""}
                    onChange={e => setTemplate(t => ({ ...t, reply_to: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-650 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="support@myana.site"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Support Email</label>
                  <input
                    type="email"
                    value={template.support_email || ""}
                    onChange={e => setTemplate(t => ({ ...t, support_email: e.target.value }))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-650 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="support@myana.site"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0 pt-2">
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
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition -mb-px border-b-2 duration-200 ${
                      activeTab === tab.id
                        ? "border-amber-500 text-amber-400"
                        : "border-transparent text-slate-500 hover:text-slate-300"
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
                  className="w-full h-80 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-3 text-[11px] font-mono text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 resize-y transition"
                  spellCheck={false}
                  placeholder="<div>Your email HTML here...</div>"
                />
              )}

              {/* Plain text editor */}
              {activeTab === "plain" && (
                <textarea
                  value={template.plain_text || ""}
                  onChange={e => setTemplate(t => ({ ...t, plain_text: e.target.value }))}
                  className="w-full h-80 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-3 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 resize-y transition"
                  placeholder="Plain text version of the email..."
                />
              )}

              {/* Style editor */}
              {activeTab === "style" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: "Button Color", key: "button_color" },
                    { label: "Brand Color", key: "brand_color" },
                    { label: "Background Color", key: "bg_color" }
                  ].map(s => (
                    <div key={s.key}>
                      <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{s.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={template[s.key] || "#e11d48"}
                          onChange={e => setTemplate(t => ({ ...t, [s.key]: e.target.value }))}
                          className="h-10 w-12 rounded-xl border border-slate-800 cursor-pointer bg-slate-950 p-1 outline-none"
                        />
                        <input
                          type="text"
                          value={template[s.key] || ""}
                          onChange={e => setTemplate(t => ({ ...t, [s.key]: e.target.value }))}
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-2.5 text-xs font-mono text-slate-100 focus:border-amber-500 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="col-span-full">
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Logo URL</label>
                    <input
                      type="url"
                      value={template.logo_url || ""}
                      onChange={e => setTemplate(t => ({ ...t, logo_url: e.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-100 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}

              {/* Preview */}
              {activeTab === "preview" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Preview Mode:</span>
                    {[
                      { id: "desktop", icon: <Monitor className="h-3.5 w-3.5" />, label: "Desktop" },
                      { id: "mobile", icon: <Smartphone className="h-3.5 w-3.5" />, label: "Mobile" },
                      { id: "dark", icon: <Moon className="h-3.5 w-3.5" />, label: "Dark Background" }
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPreviewMode(m.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition duration-200 ${
                          previewMode === m.id
                            ? "bg-amber-500 text-slate-950 border-transparent shadow-md shadow-amber-500/10"
                            : "border-slate-850 text-slate-400 hover:bg-slate-900"
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
              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/80 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:from-amber-500 hover:to-yellow-500 shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
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
                    className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-650 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 w-48"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={sending || !testEmail}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-350 hover:bg-slate-850 hover:text-slate-200 transition focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                  >
                    {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-amber-500" />}
                    {sending ? "Sending…" : "Send Test"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
              Select a template to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
