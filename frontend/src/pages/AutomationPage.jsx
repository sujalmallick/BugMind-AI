import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bot, FileCode2, Globe } from 'lucide-react'
import HeaderBar from '../components/layout/HeaderBar'
import PageHeading from '../components/shared/PageHeading'
import SegmentedControl from '../components/shared/SegmentedControl'
import SkeletonBlock from '../components/shared/SkeletonBlock'
import ToastStack from '../components/shared/ToastStack'
import useToasts from '../components/shared/useToasts'
import EnvironmentsSection from '../components/automation/EnvironmentsSection'
import ScriptsSection from '../components/automation/ScriptsSection'
import ScriptEditor from '../components/automation/ScriptEditor'
import { apiErrorMessage, listEnvironments, listScripts } from '../services/automationApi'
import { getProject } from '../services/projectApi'

export default function AutomationPage() {
  const { projectId } = useParams()
  const { toasts, showToast } = useToasts()
  const [project, setProject] = useState(null)
  const [environments, setEnvironments] = useState(null)
  const [scripts, setScripts] = useState(null)
  const [section, setSection] = useState('scripts')
  const [openScriptId, setOpenScriptId] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getProject(projectId), listEnvironments(projectId), listScripts(projectId)])
      .then(([proj, envs, scriptList]) => {
        if (cancelled) return
        setProject(proj)
        setEnvironments(envs)
        setScripts(scriptList)
        if (!envs.length) setSection('environments')
      })
      .catch((error) => {
        if (cancelled) return
        setEnvironments([])
        setScripts([])
        showToast(apiErrorMessage(error, 'Could not load automation.'), 'error')
      })
    return () => { cancelled = true }
  }, [projectId, showToast])

  // Keep the list's summary in sync with what the editor saved.
  function upsertScript(saved) {
    setScripts((prev) => {
      const summary = { ...saved }
      return prev.some((s) => s.id === saved.id) ? prev.map((s) => (s.id === saved.id ? summary : s)) : [summary, ...prev]
    })
  }

  async function refreshScripts() {
    try {
      setScripts(await listScripts(projectId))
    } catch {
      // the list keeps its last state; the next action reports errors
    }
  }

  const loading = environments === null || scripts === null

  return (
    <div className="workspace-atmosphere min-h-screen font-sans text-ink">
    <HeaderBar connected projectName={project?.name} projectId={projectId} updatedAt={project?.updatedAt} />
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-6">
      <Link to={`/project/${projectId}/workspace`}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink">
        <span aria-hidden="true">←</span> Back to workspace
      </Link>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading icon={Bot} meta={project?.name}>Automation</PageHeading>
        {!openScriptId && !loading && (
          <SegmentedControl
            label="Automation sections"
            value={section}
            onChange={setSection}
            options={[
              { value: 'scripts', label: 'Scripts', icon: FileCode2, count: scripts.length },
              { value: 'environments', label: 'Environments', icon: Globe, count: environments.length },
            ]}
          />
        )}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-20 w-full" />)}
          </div>
        ) : openScriptId ? (
          <ScriptEditor
            key={openScriptId}
            projectId={projectId}
            scriptId={openScriptId}
            environments={environments}
            showToast={showToast}
            onBack={() => setOpenScriptId(null)}
            onSaved={upsertScript}
            onDeleted={(id) => { setScripts((prev) => prev.filter((s) => s.id !== id)); setOpenScriptId(null) }}
          />
        ) : section === 'environments' ? (
          <EnvironmentsSection
            projectId={projectId}
            environments={environments}
            showToast={showToast}
            onChange={(envs) => { setEnvironments(envs); refreshScripts() }}
          />
        ) : (
          <ScriptsSection
            projectId={projectId}
            scripts={scripts}
            environments={environments}
            showToast={showToast}
            onOpen={setOpenScriptId}
            onCreated={(script) => { upsertScript(script); setOpenScriptId(script.id) }}
          />
        )}
      </div>

      <ToastStack toasts={toasts} />
    </main>
    </div>
  )
}
