import { useState } from 'react'
import { Globe, KeyRound, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import EmptyState from '../shared/EmptyState'
import Pill from '../shared/Pill'
import ConfirmDialog from '../shared/ConfirmDialog'
import { apiErrorMessage, createEnvironment, deleteEnvironment, updateEnvironment } from '../../services/automationApi'

const EMPTY = { name: '', base_url: 'https://', allowed_domains: '', notes: '', variables: [] }

function toForm(env) {
  return {
    name: env.name,
    base_url: env.baseUrl,
    allowed_domains: env.allowedDomains.slice(1).join(', '),
    notes: env.notes || '',
    // Secret values are never sent to the browser: left blank means "keep the stored value".
    variables: env.variables.map((v) => ({ name: v.name, secret: v.secret, value: v.secret ? '' : v.value ?? '', stored: v.hasValue })),
  }
}

function EnvironmentForm({ initial, saving, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setVar = (index, patch) => setForm((f) => ({
    ...f, variables: f.variables.map((v, i) => (i === index ? { ...v, ...patch } : v)),
  }))

  function submit(e) {
    e.preventDefault()
    onSave({
      name: form.name.trim(),
      base_url: form.base_url.trim(),
      allowed_domains: form.allowed_domains.split(',').map((d) => d.trim()).filter(Boolean),
      notes: form.notes,
      variables: form.variables
        .filter((v) => v.name.trim())
        .map((v) => ({
          name: v.name.trim().toUpperCase(),
          secret: v.secret,
          // A secret left blank keeps its stored value (null tells the server not to change it).
          value: v.secret && !v.value ? null : v.value,
        })),
    })
  }

  return (
    <form onSubmit={submit} className="glass-card grid gap-4 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="env-name" className="mb-1 block text-[12px] text-muted">Name</label>
          <input id="env-name" className="field" value={form.name} onChange={set('name')} maxLength={100}
                 placeholder="Staging" required />
        </div>
        <div>
          <label htmlFor="env-url" className="mb-1 block text-[12px] text-muted">Website URL</label>
          <input id="env-url" className="field" value={form.base_url} onChange={set('base_url')} maxLength={500}
                 placeholder="https://staging.example.com" required inputMode="url" />
        </div>
      </div>
      <div>
        <label htmlFor="env-domains" className="mb-1 block text-[12px] text-muted">
          Other domains tests may visit (comma separated, optional)
        </label>
        <input id="env-domains" className="field" value={form.allowed_domains} onChange={set('allowed_domains')}
               placeholder="pay.example.com, *.auth.example.com" />
        <p className="mt-1 text-[11.5px] text-muted">
          Tests can only navigate to the website and these domains. Public addresses only: the runner can't reach
          localhost or private networks.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-ink">Test variables</p>
          <button
            type="button"
            className="btn-secondary"
            disabled={form.variables.length >= 20}
            onClick={() => setForm((f) => ({ ...f, variables: [...f.variables, { name: '', value: '', secret: false }] }))}
          >
            <Plus size={13} /> Add variable
          </button>
        </div>
        {form.variables.length === 0 ? (
          <p className="text-[12px] text-muted">
            For example USER_EMAIL and a secret USER_PASSWORD. Scripts use them as {'{{vars.USER_EMAIL}}'}.
          </p>
        ) : (
          <ul className="grid gap-2">
            {form.variables.map((v, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[180px_1fr_auto_auto] sm:items-center">
                <input
                  aria-label="Variable name"
                  className="field font-mono text-[12px]"
                  value={v.name}
                  maxLength={40}
                  placeholder="USER_EMAIL"
                  onChange={(e) => setVar(i, { name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                />
                <button type="button" aria-label="Remove variable" className="rounded-lg p-1.5 text-muted hover:text-flagged sm:order-last"
                        onClick={() => setForm((f) => ({ ...f, variables: f.variables.filter((_, j) => j !== i) }))}>
                  <X size={15} />
                </button>
                <input
                  aria-label={`Value of ${v.name || 'variable'}`}
                  className="field col-span-2 sm:col-span-1"
                  type={v.secret ? 'password' : 'text'}
                  autoComplete="off"
                  value={v.value}
                  maxLength={500}
                  placeholder={v.secret && v.stored ? '•••••••• (unchanged)' : 'Value'}
                  onChange={(e) => setVar(i, { value: e.target.value })}
                />
                <label className="flex items-center gap-1.5 text-[12px] text-muted">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-signal" checked={v.secret}
                         onChange={(e) => setVar(i, { secret: e.target.checked, value: '', stored: false })} />
                  Secret
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11.5px] text-muted">
          Secret values are encrypted, never shown again and never sent to the AI.
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          Save environment
        </button>
      </div>
    </form>
  )
}

export default function EnvironmentsSection({ projectId, environments, onChange, showToast }) {
  const [editing, setEditing] = useState(null) // null | 'new' | env id
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  async function save(data) {
    setSaving(true)
    try {
      const saved = editing === 'new'
        ? await createEnvironment(projectId, data)
        : await updateEnvironment(projectId, editing, data)
      onChange(editing === 'new'
        ? [...environments, saved]
        : environments.map((e) => (e.id === saved.id ? saved : e)))
      setEditing(null)
      showToast('Environment saved.')
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not save the environment.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    try {
      await deleteEnvironment(projectId, pendingDelete.id)
      onChange(environments.filter((e) => e.id !== pendingDelete.id))
      showToast('Environment deleted. Scripts that used it need a new environment.')
    } catch (error) {
      showToast(apiErrorMessage(error, 'Could not delete the environment.'), 'error')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted">
          The websites your automated tests run against. Each one has a URL, the domains tests may visit, and test
          variables such as a login.
        </p>
        {editing === null && (
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            <Plus size={14} /> New environment
          </button>
        )}
      </div>

      {editing === 'new' && (
        <EnvironmentForm initial={EMPTY} saving={saving} onSave={save} onCancel={() => setEditing(null)} />
      )}

      {environments.length === 0 && editing !== 'new' ? (
        <EmptyState
          icon={<Globe size={18} />}
          title="No environments yet"
          description="Add the website to test, for example your staging site."
        />
      ) : (
        <ul className="grid gap-3">
          {environments.map((env) => (
            <li key={env.id}>
              {editing === env.id ? (
                <EnvironmentForm initial={toForm(env)} saving={saving} onSave={save} onCancel={() => setEditing(null)} />
              ) : (
                <div className="glass-card flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{env.name}</p>
                    <p className="truncate font-mono text-[12px] text-signal" title={env.baseUrl}>{env.baseUrl}</p>
                    {env.allowedDomains.length > 1 && (
                      <p className="mt-1 text-[12px] text-muted">Also allowed: {env.allowedDomains.slice(1).join(', ')}</p>
                    )}
                    {env.variables.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {env.variables.map((v) => (
                          <Pill key={v.name} tone={v.secret ? 'ochre' : 'neutral'} icon={v.secret ? KeyRound : undefined}>
                            {v.name}
                          </Pill>
                        ))}
                      </div>
                    )}
                  </div>
                  {editing === null && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className="btn-secondary" onClick={() => setEditing(env.id)}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button type="button" aria-label={`Delete ${env.name}`} title="Delete"
                              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-flagged-soft hover:text-flagged"
                              onClick={() => setPendingDelete(env)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete environment?"
        message={pendingDelete ? `"${pendingDelete.name}" and its variables will be deleted. Scripts using it go back to draft.` : ''}
        confirmText="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </div>
  )
}
