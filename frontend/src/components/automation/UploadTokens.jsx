import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, Plus } from 'lucide-react'
import Pill from '../shared/Pill'
import ConfirmDialog from '../shared/ConfirmDialog'
import { apiAddress, apiErrorMessage, createUploadToken, listUploadTokens, revokeUploadToken } from '../../services/automationApi'
import { formatDate } from '../../utils/automationFormat'

const STATUS = {
  active: { tone: 'verified', label: 'Active' },
  expired: { tone: 'neutral', label: 'Expired' },
  revoked: { tone: 'neutral', label: 'Revoked' },
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked: the value is selectable on screen
    }
  }
  return (
    <button type="button" className="btn-secondary shrink-0" onClick={copy} aria-label={label}>
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// Upload tokens let the user's own GitHub Actions send results here. A token can only
// upload results to this project; it's shown once and only its hash is stored.
export default function UploadTokens({ projectId, showToast }) {
  const [tokens, setTokens] = useState(null)
  const [forbidden, setForbidden] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: 'GitHub Actions', days: 90 })
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)
  const [pendingRevoke, setPendingRevoke] = useState(null)

  useEffect(() => {
    let cancelled = false
    listUploadTokens(projectId)
      .then((data) => { if (!cancelled) setTokens(data) })
      .catch((error) => {
        if (cancelled) return
        if (error?.response?.status === 403) setForbidden(true)  // viewers can't manage tokens
        else showToast(apiErrorMessage(error, 'Could not load upload tokens.'), 'error')
        setTokens([])
      })
    return () => { cancelled = true }
  }, [projectId, showToast])

  if (forbidden) return null

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const token = await createUploadToken(projectId, form.name.trim(), Number(form.days))
      setCreated(token)
      setCreating(false)
      const { token: _secret, ...stored } = token  // eslint-disable-line no-unused-vars
      setTokens((prev) => [stored, ...(prev || [])])
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not create the token.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    try {
      const updated = await revokeUploadToken(projectId, pendingRevoke.id)
      setTokens((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      showToast('Token revoked. Uploads with it stop working immediately.')
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not revoke the token.'), 'error')
    } finally {
      setPendingRevoke(null)
    }
  }

  return (
    <div className="glass-card grid gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <KeyRound size={14} aria-hidden="true" className="text-signal" /> Send results automatically from GitHub
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            An upload token lets the workflow in the downloaded tests send its results here after every run. It can only
            upload results to this project, nothing else, and you can revoke it at any time.
          </p>
        </div>
        {!creating && !created && (
          <button type="button" className="btn-secondary" onClick={() => setCreating(true)}>
            <Plus size={13} aria-hidden="true" /> New token
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="grid gap-3 rounded-xl border border-hairline bg-paper/50 p-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <div>
            <label htmlFor="token-name" className="mb-1 block text-[12px] text-muted">Name</label>
            <input id="token-name" className="field" maxLength={60} required value={form.name}
                   onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="token-expiry" className="mb-1 block text-[12px] text-muted">Expires after</label>
            <select id="token-expiry" className="field" value={form.days}
                    onChange={(e) => setForm((f) => ({ ...f, days: Number(e.target.value) }))}>
              {[30, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Create
            </button>
          </div>
        </form>
      )}

      {created && (
        <div className="grid gap-2 rounded-xl border border-ochre/40 bg-ochre-soft p-3 text-[12.5px]" role="status">
          <p className="font-medium text-ink">Copy this token now. It won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-ink">
              {created.token}
            </code>
            <CopyButton text={created.token} label="Copy the upload token" />
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>In your GitHub repository open <span className="text-ink">Settings → Secrets and variables → Actions</span>.</li>
            <li>Add a <span className="text-ink">repository secret</span> named <code className="font-mono text-ink">BUGMIND_UPLOAD_TOKEN</code> with this value.</li>
            <li>
              Download the tests again and push them: the workflow now sends results to{' '}
              <code className="break-all font-mono text-ink">{apiAddress()}</code>. If that isn't your BugMind address,
              add a repository variable <code className="font-mono text-ink">BUGMIND_URL</code> with the right one.
            </li>
          </ol>
          <button type="button" className="btn-secondary w-fit" onClick={() => setCreated(null)}>I've saved it</button>
        </div>
      )}

      {tokens === null ? (
        <p className="text-[12px] text-muted">Loading…</p>
      ) : tokens.length > 0 && (
        <ul className="grid gap-1.5">
          {tokens.map((token) => {
            const status = STATUS[token.status] ?? STATUS.revoked
            return (
              <li key={token.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">
                    {token.name} <span className="font-mono text-[11.5px] text-muted">{token.prefix}…</span>
                  </p>
                  <p className="text-[11.5px] text-muted">
                    {token.lastUsedAt ? `Last used ${formatDate(token.lastUsedAt)}` : 'Never used'}
                    {token.status === 'active' && token.expiresAt && ` · expires ${formatDate(token.expiresAt, { year: 'numeric', month: 'short', day: 'numeric' })}`}
                  </p>
                </div>
                <Pill tone={status.tone}>{status.label}</Pill>
                {token.status === 'active' && (
                  <button type="button" className="text-[12px] font-medium text-flagged hover:underline"
                          onClick={() => setPendingRevoke(token)}>
                    Revoke
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        title="Revoke upload token?"
        message={pendingRevoke ? `"${pendingRevoke.name}" stops working immediately. Workflows using it fall back to manual upload.` : ''}
        confirmText="Revoke"
        onCancel={() => setPendingRevoke(null)}
        onConfirm={revoke}
      />
    </div>
  )
}
