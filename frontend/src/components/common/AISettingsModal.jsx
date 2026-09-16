import { useState, useEffect, useCallback } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Cpu,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { getAISettings, updateAISettings, deleteProviderKey, testAIKey } from "../../services/aiSettingsApi";

// ─── Provider / Model catalogue ──────────────────────────────────────────────
const PROVIDERS = [
  {
    id: "groq",
    label: "Groq",
    color: "#f55036",
    models: [
      { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B (Recommended)" },
      { id: "groq/llama-3.1-8b-instant",   label: "Llama 3.1 8B (Ultra Fast)" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    color: "#1a73e8",
    models: [
      { id: "gemini/gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { id: "gemini/gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini/gemini-1.5-pro",   label: "Gemini 1.5 Pro" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    color: "#10a37f",
    models: [
      { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "openai/gpt-4o",      label: "GPT-4o" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    color: "#d97706",
    models: [
      { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    color: "#0ea5e9",
    models: [
      { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
    ],
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function getProviderMeta(id) {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProviderButton({ provider, selected, configured, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(provider.id)}
      className={`
        relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center
        text-xs font-semibold transition-all duration-200
        ${
          selected
            ? "border-signal bg-signal-soft text-signal shadow-sm"
            : "border-hairline bg-surface text-muted hover:border-signal/40 hover:bg-signal-soft/40 hover:text-ink"
        }
      `}
    >
      <span className="text-[11px] leading-tight">{provider.label}</span>
      {selected && (
        <CheckCircle2 size={12} className="absolute top-1.5 right-1.5 text-signal" />
      )}
      {!selected && configured && (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-verified" />
      )}
    </button>
  );
}

function ModelSelect({ models, value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full appearance-none rounded-lg border border-hairline bg-surface
          py-2.5 pl-3 pr-9 text-sm text-ink shadow-sm
          transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20
        "
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function AISettingsModal({ open, onClose, onKeySaved, onKeyDeleted }) {
  const [provider, setProvider]         = useState("groq");
  const [model, setModel]               = useState("groq/llama-3.3-70b-versatile");
  const [apiKey, setApiKey]             = useState("");
  const [showKey, setShowKey]           = useState(false);
  // providers: { gemini: { configured: bool }, openai: { configured: bool }, ... }
  const [providersStatus, setProvidersStatus] = useState({});

  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]               = useState(null);
  const [saved, setSaved]               = useState(false);
  const [testing, setTesting]           = useState(false);
  const [testResult, setTestResult]     = useState(null);

  // Load current settings when the modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    setApiKey("");
    setShowKey(false);
    setTestResult(null);

    getAISettings()
      .then((data) => {
        const p = data.provider ?? "groq";
        const m = data.model    ?? "groq/llama-3.3-70b-versatile";
        setProvider(p);
        setModel(m);
        setProvidersStatus(data.providers ?? {});
      })
      .catch(() => setError("Failed to load your AI settings."))
      .finally(() => setLoading(false));
  }, [open]);

  // When provider changes, reset model to first available and clear key input
  const handleProviderChange = useCallback((newProvider) => {
    setProvider(newProvider);
    const meta = getProviderMeta(newProvider);
    setModel(meta.models[0].id);
    setSaved(false);
    setError(null);
    setApiKey("");
    setShowKey(false);
    setTestResult(null);
    setConfirmDelete(false);
  }, []);

  const hasKeyForCurrentProvider = !!(providersStatus[provider]?.configured);

  const handleTestKey = async () => {
    if (!apiKey.trim() && !hasKeyForCurrentProvider) {
      setTestResult({
        success: false,
        message: "Please enter or paste your API key in the field above first.",
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const payload = { provider, model };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      const res = await testAIKey(payload);
      if (res.success) {
        setTestResult({ success: true, message: res.message || "Key verified successfully!" });
      } else {
        setTestResult({ success: false, message: res.error || "Key validation failed." });
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || err.message || "Network error while validating key.";
      setTestResult({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload = { provider, model };
    if (apiKey.trim()) {
      payload.api_key = apiKey.trim();
    }

    try {
      const result = await updateAISettings(payload);
      if (result.success === false) {
        setError(result.error ?? "Failed to save settings.");
      } else {
        setProvidersStatus(result.providers ?? providersStatus);
        setApiKey("");
        if (payload.api_key) {
          onKeySaved();
          return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteProviderKey(provider);
      if (result.success) {
        setProvidersStatus(result.providers ?? providersStatus);
        setApiKey("");
        setSaved(false);
        setConfirmDelete(false);
        if (onKeyDeleted) onKeyDeleted(provider);
      } else {
        setError("Failed to delete API key.");
      }
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  const providerMeta  = getProviderMeta(provider);
  const currentModels = providerMeta.models;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-hairline bg-surface shadow-2xl"
        style={{ animation: "aiModalEnter 0.22s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-hairline px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal-soft">
              <Cpu size={18} className="text-signal" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-ink">AI Settings</h2>
              <p className="text-xs text-muted">
                Configure the AI model powering this workspace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-signal" />
            </div>
          ) : (
            <>
              {/* Provider grid */}
              <div>
                <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Provider
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {PROVIDERS.map((p) => (
                    <ProviderButton
                      key={p.id}
                      provider={p}
                      selected={provider === p.id}
                      configured={!!(providersStatus[p.id]?.configured)}
                      onClick={handleProviderChange}
                    />
                  ))}
                </div>
              </div>

              {/* Model selector */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Model
                </label>
                <ModelSelect
                  models={currentModels}
                  value={model}
                  onChange={(v) => { setModel(v); setSaved(false); }}
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-hairline" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Bring Your Own Key (optional)
                </span>
                <div className="h-px flex-1 bg-hairline" />
              </div>

              {/* API Key status */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                    API Key
                  </label>
                  {/* Per-provider status badge */}
                  {hasKeyForCurrentProvider ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-verified">
                      <CheckCircle2 size={12} />
                      API Key Saved
                    </span>
                  ) : (
                    <span className="text-xs text-muted">No API Key</span>
                  )}
                </div>

                {/* Key input & Test Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <KeyRound
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setSaved(false); setTestResult(null); }}
                      placeholder={
                        hasKeyForCurrentProvider
                          ? "Enter new key to replace existing…"
                          : `Paste your ${providerMeta.label} API key…`
                      }
                      autoComplete="off"
                      className="
                        w-full rounded-lg border border-hairline bg-paper py-2.5
                        pl-9 pr-10 font-mono text-sm text-ink placeholder-muted/60
                        transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20
                      "
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                      title={showKey ? "Hide key" : "Show key"}
                    >
                      {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={testing}
                    className="
                      flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3.5 py-2.5
                      text-xs font-semibold text-ink shadow-sm transition-all hover:bg-paper
                      active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer
                    "
                    title="Test key connection"
                  >
                    {testing && <Loader2 size={13} className="animate-spin text-signal" />}
                    <span>{testing ? "Testing…" : "Test Key"}</span>
                  </button>
                </div>

                {/* Test Result Message */}
                {testResult && (
                  <div className={`mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    testResult.success
                      ? "border-verified/30 bg-verified-soft text-verified font-medium"
                      : "border-flagged/30 bg-flagged-soft text-flagged"
                  }`}>
                    {testResult.success ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <p className="mt-1.5 text-[11px] text-muted">
                  Leave blank to use the platform's shared developer key.
                  Your key is encrypted and stored securely.
                </p>
              </div>

              {/* Status messages */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-flagged/30 bg-flagged-soft px-3 py-2.5 text-sm text-flagged">
                  <AlertCircle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              {saved && (
                <div className="flex items-center gap-2 rounded-lg border border-verified/30 bg-verified-soft px-3 py-2.5 text-sm text-verified">
                  <CheckCircle2 size={15} className="shrink-0" />
                  Settings saved successfully.
                </div>
              )}

              {/* Delete confirmation dialog */}
              {confirmDelete && (
                <div className="rounded-xl border border-flagged/40 bg-flagged-soft p-4">
                  <p className="text-sm font-semibold text-flagged">
                    Delete {getProviderMeta(provider).label} API key?
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    The stored key will be permanently removed. You can add a new one at any time.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteKey}
                      disabled={deleting}
                      className="flex items-center gap-1.5 rounded-lg bg-flagged px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                    >
                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Yes, delete it
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-paper hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between gap-3 border-t border-hairline px-6 py-4">
            {/* Delete Key — only visible when a key is saved for this provider */}
            <div>
              {hasKeyForCurrentProvider && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    confirmDelete
                      ? "border-flagged bg-flagged-soft text-flagged"
                      : "border-flagged/40 text-flagged hover:bg-flagged-soft"
                  }`}
                >
                  <Trash2 size={13} />
                  Delete Key
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-paper hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-signal/90 disabled:opacity-60"
              >
                {saving ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving…</>
                ) : hasKeyForCurrentProvider && apiKey.trim() ? (
                  "Update Key"
                ) : apiKey.trim() ? (
                  "Save Key"
                ) : (
                  "Save Settings"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
