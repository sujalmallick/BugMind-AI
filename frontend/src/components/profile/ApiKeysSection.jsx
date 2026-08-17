import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { getAISettings, updateAISettings, deleteProviderKey } from "../../services/aiSettingsApi";

/**
 * ApiKeysSection — Exact BYOK UI relocated from AISettingsModal into the
 * Profile page. No behavior changes from the original modal implementation.
 *
 * Props:
 *   showToast (msg) => void
 */

const PROVIDERS = [
  {
    id: "gemini",
    label: "Google Gemini",
    models: [
      { id: "gemini/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini/gemini-2.5-pro",   label: "Gemini 2.5 Pro" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "openai/gpt-4o",      label: "GPT-4o" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    models: [{ id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B" }],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    models: [{ id: "deepseek/deepseek-chat", label: "DeepSeek Chat" }],
  },
];

function getProviderMeta(id) {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export default function ApiKeysSection({ showToast }) {
  const [provider, setProvider]   = useState("gemini");
  const [model, setModel]         = useState("gemini/gemini-2.5-flash");
  const [apiKey, setApiKey]       = useState("");
  const [providersStatus, setProvidersStatus] = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]         = useState(null);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    setLoading(true);
    getAISettings()
      .then((data) => {
        setProvider(data.provider ?? "gemini");
        setModel(data.model ?? "gemini/gemini-2.5-flash");
        setProvidersStatus(data.providers ?? {});
      })
      .catch(() => setError("Failed to load AI settings."))
      .finally(() => setLoading(false));
  }, []);

  const handleProviderChange = useCallback((id) => {
    setProvider(id);
    setModel(getProviderMeta(id).models[0].id);
    setSaved(false);
    setError(null);
    setApiKey("");
    setConfirmDelete(false);
  }, []);

  const hasKey = !!(providersStatus[provider]?.configured);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const payload = { provider, model };
    if (apiKey.trim()) payload.api_key = apiKey.trim();
    try {
      const result = await updateAISettings(payload);
      if (result.success === false) {
        setError(result.error ?? "Failed to save settings.");
      } else {
        setProvidersStatus(result.providers ?? providersStatus);
        setApiKey("");
        if (payload.api_key) {
          showToast("API key saved successfully.");
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
        const providerLabel = getProviderMeta(provider).label;
        showToast(`${providerLabel} API key removed.`);
      } else {
        setError("Failed to delete API key.");
      }
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const providerMeta  = getProviderMeta(provider);
  const currentModels = providerMeta.models;

  return (
    <section className="signal-card p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-ink mb-1">AI API Keys</h2>
      <p className="text-sm text-muted mb-6">
        Bring your own API keys to use your preferred AI provider. Keys are encrypted and stored securely.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading settings…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-5 max-w-lg">
          {/* Provider grid */}
          <div>
            <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Provider
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  className={`
                    relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-3
                    text-[11px] font-semibold transition-all duration-200
                    ${
                      provider === p.id
                        ? "border-signal bg-signal-soft text-signal shadow-sm"
                        : "border-hairline bg-surface text-muted hover:border-signal/40 hover:bg-signal-soft/40 hover:text-ink"
                    }
                  `}
                >
                  {p.label}
                  {provider === p.id && <CheckCircle2 size={12} className="absolute top-1.5 right-1.5 text-signal" />}
                  {provider !== p.id && providersStatus[p.id]?.configured && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-verified" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Model selector */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => { setModel(e.target.value); setSaved(false); }}
                className="w-full appearance-none rounded-lg border border-hairline bg-surface py-2.5 pl-3 pr-9 text-sm text-ink shadow-sm focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
              >
                {currentModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Bring Your Own Key (optional)</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          {/* API Key input */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">API Key</label>
              {hasKey ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-verified">
                  <CheckCircle2 size={12} /> API Key Saved
                </span>
              ) : (
                <span className="text-xs text-muted">No API Key</span>
              )}
            </div>
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
                placeholder={hasKey ? "Enter new key to replace existing…" : `Paste your ${providerMeta.label} API key…`}
                autoComplete="off"
                className="w-full rounded-lg border border-hairline bg-paper py-2.5 pl-9 pr-4 font-mono text-sm text-ink placeholder-muted/60 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Leave blank to use the platform's shared developer key.</p>
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

          {/* Delete confirm inline */}
          {confirmDelete && (
            <div className="rounded-xl border border-flagged/40 bg-flagged-soft p-4">
              <p className="text-sm font-semibold text-flagged">Delete {providerMeta.label} API key?</p>
              <p className="mt-1 text-xs text-muted">The stored key will be permanently removed.</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleDeleteKey}
                  disabled={deleting}
                  className="flex items-center gap-1.5 rounded-lg bg-flagged px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Yes, delete it
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-muted hover:bg-paper hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between">
            {hasKey && (
              <button
                type="button"
                onClick={() => setConfirmDelete((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${confirmDelete ? "border-flagged bg-flagged-soft text-flagged" : "border-flagged/40 text-flagged hover:bg-flagged-soft"}`}
              >
                <Trash2 size={13} />
                Delete Key
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary ml-auto flex items-center gap-2"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : hasKey && apiKey.trim() ? "Update Key" : apiKey.trim() ? "Save Key" : "Save Settings"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
