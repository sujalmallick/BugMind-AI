import { useEffect, useState } from "react";
import { useWorkspace } from "../hooks/useWorkspace";
import HeaderBar from "../components/layout/HeaderBar";
import AppFooter from "../components/layout/AppFooter";
import ConfirmDialog from "../components/common/ConfirmDialog";
import WorkflowInputPanel from "../components/layout/WorkflowInputPanel";
import TabBar from "../components/layout/TabBar";
import CommandPalette from "../components/layout/CommandPalette";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ToastStack from "../components/shared/ToastStack";
import useToasts from "../components/shared/useToasts";
import AIThinking from "../components/shared/AIThinking";
import APIErrorCard from "../components/shared/APIErrorCard";
import AnalysisSummary from "../components/shared/AnalysisSummary";
import ModulesTab from "../components/tabs/ModulesTab";
import ChecklistTab from "../components/tabs/ChecklistTab";
import TestCasesTab from "../components/tabs/TestCasesTab";
import IssueAnalysisTab from "../components/tabs/IssueAnalysisTab";
import TrackerTab from "../components/tabs/TrackerTab";
import { analyzeWorkflow, classifyIssue, saveAnalysis, getAnalysis } from "../services/analysisApi";
import { useRef } from "react";

import {
  getProject,
  updateProject,
} from "../services/projectApi";
import {
  saveTestCases,
  getTestCases,
} from "../services/testCaseApi";
import {
  saveIssue,
  getIssues,
} from "../services/issueApi";



const TABS = [
  { key: 'modules', label: 'Modules' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'testcases', label: 'Test Cases' },
  { key: 'issues', label: 'Issue Analysis' },
  { key: 'tracker', label: 'Tracker' },
]

const EMPTY_ISSUE_FORM = { observation: '', expected: '', actual: '', mode: 'failed' }
export default function WorkspacePage() {
  const { projectId } = useParams();
  console.log("Workspace Route ID:", projectId);
  const location = useLocation();
const navigate = useNavigate();
const [analysisMeta, setAnalysisMeta] = useState(null);
const [analysisOutdated, setAnalysisOutdated] = useState(false);
const {
  workspace,
  loading: workspaceLoading,
  save: saveWorkspace,
} = useWorkspace(projectId);

const isWorkspaceRoute =
  location.pathname.endsWith("/workspace");
 
  const { toasts, showToast } = useToasts();

  useEffect(() => {
    const handleOffline = () => {
      showToast("Network connection lost. You are offline.", "error");
    };
    window.addEventListener('network-offline', handleOffline);
    return () => window.removeEventListener('network-offline', handleOffline);
  }, [showToast]);


  useEffect(() => {

  async function loadProject() {

    try {

      const data =
        await getProject(projectId);

      setProject(data);

    } catch (err) {

      console.error(err);

    }

  }

  loadProject();

}, [projectId]);

const hasLoadedProject = useRef(false);
const [project, setProject] = useState(null);

  // Workflow input + analysis
  const [workflow, setWorkflow] = useState('')
  const [observedSteps, setObservedSteps] = useState('')
  const [testEnvironment, setTestEnvironment] = useState({
  platform: "",
  osVersion: "",
  build: "",
  device: "",
});
  const [analysisStatus, setAnalysisStatus] = useState('idle') 
  // idle | loading | success | error
  const [analysisError, setAnalysisError] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [testCases, setTestCases] = useState([])
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('modules')
  const [showSummary, setShowSummary] = useState(false)
const [checkedItems, setCheckedItems] = useState({});
const [showReanalyzeDialog, setShowReanalyzeDialog] = useState(false);
  // Issue analysis
  const [issueForm, setIssueForm] = useState(EMPTY_ISSUE_FORM)
  const [issueStatus, setIssueStatus] = useState('idle')
  const [issueError, setIssueError] = useState(null)
  const [issueResult, setIssueResult] = useState(null)
  const [issueHistory, setIssueHistory] = useState([]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  
  const isAnalyzing = analysisStatus === 'loading'
 const showWorkspace = analysisStatus === 'success'

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (analysisStatus === 'loading') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [analysisStatus]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

useEffect(() => {

  async function loadWorkspaceData() {

   if (!workspace) return;

    setWorkflow(workspace.workflow || "");
    setObservedSteps(workspace.observed_steps || "");

    setTestEnvironment({
      platform: workspace.platform || "",
      osVersion: workspace.os_version || "",
      build: workspace.build || "",
      device: workspace.device || "",
      
      
    });
    setCheckedItems(
  workspace.checklist_progress || {}
);

    try {

      const analysisData =
        await getAnalysis(projectId);

      if (analysisData?.result) {

        setAnalysis(analysisData.result);

        try {
  const cases =
  await getTestCases(projectId);

setTestCases(
  cases.map(tc => ({
    id: tc.test_case_id,
    description: tc.description,
    module: tc.module,
    category: tc.category,
    priority: tc.priority,
    status: tc.status,
    preconditions: tc.preconditions,
    steps: tc.steps,
    expectedResult: tc.expected_result,
    actualResult: tc.actual_result,
    notes: tc.notes,
  }))
);

} catch (e) {
  console.log("No saved test cases.");
}
try {

  const issues =
    await getIssues(projectId);

  setIssueHistory(issues);

} catch (e) {

  console.log("No saved issues.");

}


        setAnalysisStatus("success");

      }

    } catch (error) {

      console.log("No saved analysis found.");

    }


  }

  loadWorkspaceData();

}, [workspace,projectId]);

useEffect(() => {
  if (!workspace) return;

  const controller = new AbortController();
  const timer = setTimeout(async () => {
    try {
      await saveWorkspace({
        workflow,
        observed_steps: observedSteps,
        platform: testEnvironment.platform,
        os_version: testEnvironment.osVersion,
        build: testEnvironment.build,
        device: testEnvironment.device,
         checklist_progress: checkedItems,
      }, { signal: controller.signal });
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error("Workspace save failed:", err);
        showToast("Failed to autosave workspace. Please check your connection.", "error");
      }
    }
  }, 600);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };

}, [
  workflow,
  observedSteps,
  testEnvironment,
  checkedItems,
]);

useEffect(() => {
  if (!analysisMeta) {
    setAnalysisOutdated(false);
    return;
  }

  const changed =
    workflow.trim() !==
    analysisMeta.workflowSnapshot?.trim();

  setAnalysisOutdated(changed);

}, [workflow, analysisMeta]);




  async function runAnalysis() {
    

    setAnalysisStatus('loading')
    setAnalysisError(null)
    try {
      const result = await analyzeWorkflow({
    workflow,
    observedSteps,
})

if (result.success === false) {
    setApiError(result.error)
    setAnalysisStatus("error")
    return
}

setApiError(null)
setAnalysis(result)

await saveAnalysis(
  projectId,
  result
);
setTestCases(result.testCases)
await saveTestCases(
  projectId,
  result.testCases
);
await updateProject(projectId, {
  name: project.name,
  description: project.description,
  status: "Analyzed",
});

const updatedProject =
  await getProject(projectId);

setProject(updatedProject);

setCheckedItems({});
setCheckedItems({});

await saveWorkspace({
  workflow,
  observed_steps: observedSteps,
  platform: testEnvironment.platform,
  os_version: testEnvironment.osVersion,
  build: testEnvironment.build,
  device: testEnvironment.device,
  checklist_progress: {},
});
setAnalysisStatus("success")
setPanelCollapsed(true);
setActiveTab("modules");

showToast("Workflow analyzed successfully!");

navigate(`/project/${projectId}/workspace`);

    } catch (error) {
      setAnalysisStatus('error')
      setAnalysisError(error.message)
    }
  }
function handleAnalyze() {
    if (analysisStatus === 'loading') return;

    if (testCases.length > 0) {
        setShowReanalyzeDialog(true);
        return;
    }

    runAnalysis();
}
async function handleStatusChange(id, status) {

  const updated = testCases.map((tc) =>
    tc.id === id
      ? { ...tc, status }
      : tc
  );

  setTestCases(updated);

  try {

    await saveTestCases(
      projectId,
      updated
    );

  } catch (err) {

    console.error(err);

  }

  showToast(`${id} marked ${status}`);
}
  function handleToggleChecklistItem(id) {
    setCheckedItems((current) => ({ ...current, [id]: !current[id] }))
  }

  function handleJumpToIssue(testCase) {
    setIssueForm({ ...EMPTY_ISSUE_FORM, mode: 'failed', observation: testCase.description })
    setActiveTab('issues')
  }
async function handleGenerateIssue() {

  if (!issueForm.observation.trim()) {
    showToast("Please enter an observation first.")
    return
  }

  if (
    issueForm.mode === "failed" &&
    (
      !issueForm.expected.trim() ||
      !issueForm.actual.trim()
    )
  ) {
    showToast("Expected and Actual result are required.")
    return
  }

  setIssueStatus("loading")
  setIssueError(null)
  setIssueResult(null)

  try {

    const result = await classifyIssue({
      ...issueForm,
      workflow,
    })

    // Handle API errors (quota exceeded, invalid key, etc.)
    if (result.success === false) {
      setIssueStatus("error")
      setIssueError(result.error)
      return
    }

   setIssueResult(result);

await saveIssue(
  projectId,
  {
    test_case_id: issueForm.observation,
    bug_id:
      `BUG-${Date.now()}`,
    title:
      result.title || "Untitled Bug",
    description:
      issueForm.observation,
    severity:
      result.severity,
    priority:
      result.priority,
    status: "Open",
    reproduction_steps:
      issueForm.observation,
    expected_result:
      issueForm.expected,
    actual_result:
      issueForm.actual,
  }
);

setIssueStatus("success");

showToast("Issue analysis completed!");

  } catch (error) {

    setIssueStatus("error")

    if (error.response?.data?.error) {
      setIssueError(error.response.data.error)
    } else {
      setIssueError(error.message || "Something went wrong.")
    }

  }
}

function handleCopyIssueResult() {
  if (!issueResult) return

  const lines =
    issueForm.mode === "failed"
      ? [
          `**Bug type:** ${issueResult.bugType}`,
          `**Severity:** ${issueResult.severity}`,
          `**Priority:** ${issueResult.priority}`,
          `**Title:** ${issueResult.title}`,
        ]
      : [
          `**Observation type:** ${issueResult.observationType}`,
          `**Severity:** ${issueResult.severity}`,
          `**Suggested action:** ${issueResult.suggestedAction}`,
        ]

  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => showToast("Markdown copied successfully!"))
}

  const tabsWithCounts = TABS.map((tab) =>
    tab.key === 'testcases' ? { ...tab, count: testCases.length } : tab,
  )

  const commands = [
    ...TABS.map((tab) => ({ label: `Go to ${tab.label}`, action: () => setActiveTab(tab.key) })),
    { label: 'Edit workflow', action: () => setPanelCollapsed(false) },
  ]

  return (
  <div className="workspace-atmosphere min-h-screen font-sans text-ink">

  
<HeaderBar
  connected
  onOpenCommandPalette={() => setCommandPaletteOpen(true)}
  projectName={project?.name}
  updatedAt={project?.updatedAt}
/>


<div className="mx-auto max-w-7xl px-4 sm:px-8">
      <WorkflowInputPanel
        workflow={workflow}
        observedSteps={observedSteps}
        onWorkflowChange={setWorkflow}
        onObservedStepsChange={setObservedSteps}
        analysisOutdated={analysisOutdated}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        isCollapsed={panelCollapsed && showWorkspace}
        onExpand={() => setPanelCollapsed(false)}
        error={analysisError}
        hasResult={showWorkspace}
testEnvironment={testEnvironment}        onTestEnvironmentChange={setTestEnvironment}
      />
</div>
{analysisStatus === "error" && (
  <main className="flex-1">
    <APIErrorCard
      message={apiError}
      onRetry={handleAnalyze}
    />
  </main>
)}
      {analysisStatus === "loading" && (
  <main className="flex-1">
    <AIThinking title="Analyzing Workflow" />
  </main>
)}
{analysisStatus === "success" && (
  <>
    {/* ---------------- ANALYZE PAGE ---------------- */}
    {!isWorkspaceRoute ? (
    <AnalysisSummary
  analysis={analysis}
  testCases={testCases}
  testEnvironment={testEnvironment}
  onContinue={() =>
    navigate(`/project/${projectId}/workspace`)
  }
/>
    ) : (
      <>
        {/* ---------------- WORKSPACE ---------------- */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(`/project/${projectId}`)
              }
              className="btn-secondary px-3 py-1.5 text-[13px]"
            >
              ← Back to Summary
            </button>
            <span className="hidden text-xs font-bold uppercase tracking-wide text-muted sm:inline-block">
              Workspace
            </span>
          </div>

          <TabBar
            tabs={tabsWithCounts}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <main key={activeTab} className="animate-tab-enter mt-6 pb-12">

          {activeTab === "modules" && (
            <ModulesTab
              analysis={analysis}
              isLoading={false}
            />
          )}

          {activeTab === "checklist" && (
            <ChecklistTab
              checklist={analysis?.checklist ?? []}
              isLoading={false}
              checkedItems={checkedItems}
              onToggleItem={handleToggleChecklistItem}
            />
          )}

          {activeTab === "testcases" && (
            <TestCasesTab
              testCases={testCases}
              isLoading={false}
              onStatusChange={handleStatusChange}
              onJumpToIssue={handleJumpToIssue}
              showToast={showToast}
            />
          )}

          {activeTab === "issues" && (
            <IssueAnalysisTab
              form={issueForm}
              onFormChange={setIssueForm}
              onGenerate={handleGenerateIssue}
              isGenerating={issueStatus === "loading"}
              result={issueResult}
              error={issueError}
              onCopy={handleCopyIssueResult}
            />
          )}

          {activeTab === "tracker" && (
            <TrackerTab
              testCases={testCases}
              onStatusChange={handleStatusChange}
              onJumpToIssue={handleJumpToIssue}
              showToast={showToast}
            />
          )}

        </main>
      </>
    )}
  </>
)}

      <AppFooter />

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} commands={commands} /><ConfirmDialog
    open={showReanalyzeDialog}
    title="Replace Existing Analysis?"
    message="Regenerating will replace the current AI-generated checklist and test cases. Any execution progress associated with them may also be removed."
    confirmText="Replace & Regenerate"
    cancelText="Cancel"
    onCancel={() => setShowReanalyzeDialog(false)}
    onConfirm={() => {
        setShowReanalyzeDialog(false);
        runAnalysis();
    }}
/>
      <ToastStack toasts={toasts} />
    </div>
  )
}
