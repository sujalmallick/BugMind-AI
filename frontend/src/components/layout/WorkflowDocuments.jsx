import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileText, Loader2, Paperclip, RotateCw, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import Pill from '../shared/Pill'
import SkeletonBlock from '../shared/SkeletonBlock'
import ConfirmDialog from '../shared/ConfirmDialog'
import {
  deleteDocument,
  downloadDocument,
  draftWorkflowFromDocuments,
  listDocuments,
  retryDocument,
  setDocumentAiEnabled,
  uploadDocument,
} from '../../services/documentApi'

// Reference documents (specs, PRDs, notes) attached to the project from the workflow panel.
// They are project-wide: every analysis of this project can draw on them.

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown'
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'markdown']
const FILE_TYPES = ['PDF', 'DOCX', 'TXT', 'MD']
const MAX_BYTES = 10 * 1024 * 1024
const POLL_MS = 3000

const STATUS = {
  uploaded: { tone: 'neutral', label: 'Queued' },
  processing: { tone: 'signal', label: 'Processing' },
  ready: { tone: 'verified', label: 'Ready' },
  failed: { tone: 'flagged', label: 'Failed' },
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function errorMessage(error, fallback) {
  return error?.response?.data?.detail || error?.response?.data?.error || fallback
}

function DocumentRow({ doc, busy, onToggleAi, onRetry, onDownload, onDelete }) {
  const status = STATUS[doc.status] ?? STATUS.uploaded
  const pending = doc.status === 'uploaded' || doc.status === 'processing'

  return (
    <li className="flex flex-col gap-2 border-b border-hairline px-3 py-2.5 last:border-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <FileText size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink" title={doc.filename}>{doc.filename}</p>
          <p className="text-[12px] text-muted">
            {doc.fileType.toUpperCase()} · {formatSize(doc.sizeBytes)}
            {doc.pageCount ? ` · ${doc.pageCount} pages` : ''}
          </p>
          {doc.status === 'failed' && doc.error && (
            <p className="mt-1 text-[12px] text-flagged">{doc.error}</p>
          )}
          {doc.flaggedChunkCount > 0 && (
            <p className="mt-1 flex items-center gap-1 text-[12px] text-ochre">
              <ShieldAlert size={12} aria-hidden="true" />
              {doc.flaggedChunkCount} section{doc.flaggedChunkCount > 1 ? 's' : ''} ignored: looked like instructions to the AI
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
        <Pill tone={status.tone}>
          {pending && <Loader2 size={11} className="animate-spin" aria-hidden="true" />}
          {status.label}
        </Pill>

        <label
          className={`flex items-center gap-1.5 text-[12px] ${doc.status === 'ready' ? 'text-muted' : 'text-muted/50'}`}
          title={doc.status === 'ready' ? 'Let the AI use this document as context' : 'Available once processing finishes'}
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-signal"
            checked={doc.aiEnabled}
            disabled={doc.status !== 'ready' || busy}
            onChange={(e) => onToggleAi(doc, e.target.checked)}
          />
          Use in AI
        </label>

        {doc.status === 'failed' && (
          <button type="button" className="btn-secondary" onClick={() => onRetry(doc)} disabled={busy}>
            <RotateCw size={13} /> Retry
          </button>
        )}
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
          onClick={() => onDownload(doc)}
          aria-label={`Download ${doc.filename}`}
          title="Download"
        >
          <Download size={15} />
        </button>
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-flagged-soft hover:text-flagged"
          onClick={() => onDelete(doc)}
          aria-label={`Remove ${doc.filename}`}
          title="Remove"
          disabled={busy}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  )
}

export default function WorkflowDocuments({ projectId, showToast, workflow, onDraft }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [focus, setFocus] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftResult, setDraftResult] = useState(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const inputRef = useRef(null)

  // The project this panel currently shows: responses for another project are ignored.
  const projectRef = useRef(projectId)
  useEffect(() => {
    projectRef.current = projectId
  }, [projectId])
  // Latest workflow text: a draft never overwrites edits made while it was generating.
  const workflowRef = useRef(workflow)
  useEffect(() => {
    workflowRef.current = workflow
  }, [workflow])
  // Background polling reports a failure once, not on every tick.
  const pollErrorShown = useRef(false)

  const refresh = useCallback(async ({ background = false } = {}) => {
    const requestedFor = projectId
    try {
      const docs = await listDocuments(requestedFor)
      if (projectRef.current !== requestedFor) return
      setDocuments(docs)
      pollErrorShown.current = false
    } catch (error) {
      if (projectRef.current !== requestedFor) return
      if (!background || !pollErrorShown.current) {
        showToast(errorMessage(error, 'Could not load project documents.'), 'error')
        pollErrorShown.current = background
      }
    } finally {
      if (projectRef.current === requestedFor) setLoading(false)
    }
  }, [projectId, showToast])

  useEffect(() => {
    let cancelled = false
    listDocuments(projectId)
      .then((docs) => { if (!cancelled) setDocuments(docs) })
      .catch((error) => { if (!cancelled) showToast(errorMessage(error, 'Could not load project documents.'), 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId, showToast])

  // Poll while anything is still being processed in the background.
  const hasPending = documents.some((d) => d.status === 'uploaded' || d.status === 'processing')
  useEffect(() => {
    if (!hasPending) return undefined
    const timer = setInterval(() => refresh({ background: true }), POLL_MS)
    return () => clearInterval(timer)
  }, [hasPending, refresh])

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length || uploading) return
    setUploading(true)
    let uploaded = 0
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        showToast(`${file.name}: attach PDF, DOCX, TXT or Markdown files.`, 'error')
        continue
      }
      if (file.size > MAX_BYTES) {
        showToast(`${file.name}: files can be at most 10 MB.`, 'error')
        continue
      }
      try {
        await uploadDocument(projectId, file)
        uploaded += 1
      } catch (error) {
        showToast(`${file.name}: ${errorMessage(error, 'upload failed.')}`, 'error')
      }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (uploaded) {
      showToast(`${uploaded} document${uploaded > 1 ? 's' : ''} attached. Processing has started.`)
      refresh()
    }
  }

  async function runAction(doc, action, successMessage) {
    setBusyId(doc.id)
    try {
      await action()
      if (successMessage) showToast(successMessage)
      await refresh()
    } catch (error) {
      showToast(errorMessage(error, 'Something went wrong.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function runDraft() {
    setConfirmReplace(false)
    setDrafting(true)
    const requestedFor = projectId
    const workflowBefore = workflowRef.current
    try {
      const result = await draftWorkflowFromDocuments(projectId, focus)
      if (projectRef.current !== requestedFor) return
      if (!result?.success) {
        showToast(result?.error || 'Could not draft a workflow.', 'error')
        return
      }
      if (workflowRef.current !== workflowBefore) {
        showToast('You edited the workflow while it was being drafted, so the draft was not applied.', 'error')
        return
      }
      onDraft(result.workflow)
      setDraftResult(result)
    } catch (error) {
      if (projectRef.current === requestedFor) showToast(errorMessage(error, 'Could not draft a workflow.'), 'error')
    } finally {
      if (projectRef.current === requestedFor) setDrafting(false)
    }
  }

  const canDraft = documents.some((d) => d.availableToAi)

  return (
    <div>
      <p className="mb-1 text-[13px] font-medium text-ink">
        Reference documents
        <span className="ml-1 font-normal text-muted">(optional)</span>
      </p>
      <p className="mb-3 text-[12px] leading-relaxed text-muted">
        Specs, PRDs or notes for this project. The AI uses only the relevant parts; your workflow
        description stays the main source of truth.
      </p>

      <button
        type="button"
        // Not `disabled` while uploading: a disabled drop target would let the browser
        // open a dropped file in place of the page and lose the typed workflow.
        onClick={() => { if (!uploading) inputRef.current?.click() }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        aria-disabled={uploading}
        className={`flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-4 text-center transition-colors sm:flex-row sm:justify-between sm:text-left ${
          dragging ? 'border-signal bg-signal-soft' : 'border-hairline bg-paper/50 hover:border-signal/50'
        }`}
      >
        <span className="flex items-center gap-2 text-[13px] text-ink">
          {uploading
            ? <Loader2 size={15} className="animate-spin text-signal" aria-hidden="true" />
            : <Paperclip size={15} className="text-signal" aria-hidden="true" />}
          {uploading ? 'Attaching…' : 'Attach files or drop them here'}
        </span>
        <span className="flex flex-wrap items-center justify-center gap-1.5">
          {FILE_TYPES.map((type) => (
            <span key={type} className="rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted">
              {type}
            </span>
          ))}
          <span className="text-[11px] text-muted">· up to 10 MB</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {loading ? (
        <SkeletonBlock className="mt-3 h-12 w-full" />
      ) : documents.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-xl border border-hairline bg-surface">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              busy={busyId === doc.id}
              onToggleAi={(d, enabled) => runAction(d, () => setDocumentAiEnabled(projectId, d.id, enabled))}
              onRetry={(d) => runAction(d, () => retryDocument(projectId, d.id), 'Processing restarted.')}
              onDownload={(d) => downloadDocument(projectId, d).catch((error) =>
                showToast(errorMessage(error, 'Download failed.'), 'error'))}
              onDelete={(d) => setPendingDelete(d)}
            />
          ))}
        </ul>
      )}

      {canDraft && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="wf-draft-focus" className="sr-only">Focus for the drafted workflow</label>
          <input
            id="wf-draft-focus"
            type="text"
            className="field sm:flex-1"
            placeholder="Focus (optional), e.g. checkout or password reset"
            maxLength={300}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary shrink-0"
            disabled={drafting}
            onClick={() => (workflow?.trim() ? setConfirmReplace(true) : runDraft())}
          >
            {drafting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
            {drafting ? 'Drafting…' : 'Draft workflow from documents'}
          </button>
        </div>
      )}

      {draftResult && (
        <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-2.5 text-[12px] leading-relaxed text-muted" role="status">
          <div className="flex items-start justify-between gap-2">
            <p>
              <span className="font-medium text-ink">Workflow drafted</span>
              {draftResult.sources?.length > 0 && ` from ${draftResult.sources.map((s) => s.filename).join(', ')}`}.
              {' '}Review and edit it above before analysing.
            </p>
            <button
              type="button"
              className="rounded-md p-0.5 text-muted hover:text-ink"
              onClick={() => setDraftResult(null)}
              aria-label="Dismiss draft notes"
            >
              <X size={14} />
            </button>
          </div>
          {draftResult.leftOut?.length > 0 && (
            <div className="mt-2">
              <p className="text-ochre">Left out, because your documents don’t support them:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {draftResult.leftOut.map((step, i) => (
                  <li key={i}>{step.text} <span className="text-muted/80">({step.note})</span></li>
                ))}
              </ul>
            </div>
          )}
          {draftResult.gaps?.length > 0 && (
            <div className="mt-2">
              <p className="text-ink">Not covered by your documents (worth clarifying):</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {draftResult.gaps.map((gap, i) => <li key={i}>{gap}</li>)}
              </ul>
            </div>
          )}
          {draftResult.removedForSafety > 0 && (
            <p className="mt-2 flex items-center gap-1 text-ochre">
              <ShieldAlert size={12} aria-hidden="true" />
              {draftResult.removedForSafety} step{draftResult.removedForSafety > 1 ? 's' : ''} removed by safety checks.
            </p>
          )}
        </div>
      )}

      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        Relevant excerpts from documents marked “Use in AI” are sent to your AI provider during analysis.
        Secrets like API keys and passwords are removed first.
      </p>

      <ConfirmDialog
        open={confirmReplace}
        title="Replace the workflow?"
        message="The drafted workflow will replace what's in the workflow box now."
        confirmText="Draft and replace"
        danger={false}
        onCancel={() => setConfirmReplace(false)}
        onConfirm={runDraft}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove document?"
        message={pendingDelete ? `"${pendingDelete.filename}" will be deleted from this project and no longer used by the AI.` : ''}
        confirmText="Remove"
        loading={busyId === pendingDelete?.id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const doc = pendingDelete
          await runAction(doc, () => deleteDocument(projectId, doc.id), 'Document removed.')
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
