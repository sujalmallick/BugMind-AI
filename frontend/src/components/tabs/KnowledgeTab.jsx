import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Download, FileText, Loader2, RotateCw, ShieldAlert, Trash2, Upload } from 'lucide-react'
import EmptyState from '../shared/EmptyState'
import Pill from '../shared/Pill'
import SkeletonBlock from '../shared/SkeletonBlock'
import ConfirmDialog from '../shared/ConfirmDialog'
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  retryDocument,
  setDocumentAiEnabled,
  uploadDocument,
} from '../../services/documentApi'

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown'
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'markdown']
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
    <li className="flex flex-col gap-2 border-b border-hairline px-4 py-3 last:border-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-paper text-muted">
          <FileText size={15} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink" title={doc.filename}>{doc.filename}</p>
          <p className="text-[12px] text-muted">
            {doc.fileType.toUpperCase()} · {formatSize(doc.sizeBytes)}
            {doc.pageCount ? ` · ${doc.pageCount} pages` : ''}
            {doc.uploadedBy ? ` · ${doc.uploadedBy.name}` : ''}
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

      <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
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
          {doc.availableToAi ? 'Used by AI' : 'Use in AI'}
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
          aria-label={`Delete ${doc.filename}`}
          title="Delete"
          disabled={busy}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  )
}

export default function KnowledgeTab({ projectId, showToast }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments(projectId))
    } catch (error) {
      showToast(errorMessage(error, 'Could not load project documents.'), 'error')
    } finally {
      setLoading(false)
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
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [hasPending, refresh])

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setUploading(true)
    let uploaded = 0
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        showToast(`${file.name}: upload PDF, DOCX, TXT or Markdown files.`, 'error')
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
      showToast(`${uploaded} document${uploaded > 1 ? 's' : ''} uploaded. Processing has started.`)
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

  const readyForAi = documents.filter((d) => d.availableToAi).length

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Project knowledge</h2>
          <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-muted">
            Upload specs, PRDs or notes. The AI uses only the relevant parts as extra context;
            your workflow description stays the main source of truth.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Uploading…' : 'Upload documents'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        className={`rounded-xl transition-colors ${dragging ? 'ring-2 ring-signal/40' : ''}`}
      >
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={18} />}
            title="No documents yet"
            description="Drop PDF, DOCX, TXT or Markdown files here (up to 10 MB each, 20 per project)."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-hairline bg-paper/60 px-4 py-2 text-[12px] text-muted">
              <span>{documents.length} document{documents.length > 1 ? 's' : ''}</span>
              <span>{readyForAi} available to AI</span>
            </div>
            <ul>
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
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete document?"
        message={pendingDelete ? `"${pendingDelete.filename}" will be removed and no longer used by the AI.` : ''}
        confirmText="Delete"
        loading={busyId === pendingDelete?.id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const doc = pendingDelete
          await runAction(doc, () => deleteDocument(projectId, doc.id), 'Document deleted.')
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
