import React, { useState, useMemo, useCallback } from "react";
import EditableDataGrid from "../shared/EditableDataGrid";
import TestCaseTable from "../shared/TestCaseTable";
import EmptyState from "../shared/EmptyState";
import CreateTestCaseModal from "../workspace/CreateTestCaseModal";
import ImportCsvModal from "../csv/ImportCsvModal";
import { exportTestCasesCSV } from "../../lib/exportCSV";
import { updateTestCase, deleteTestCase, createManualTestCase } from "../../services/testCaseApi";
import { Table2, Plus, Download, Filter, X, Upload } from "lucide-react";

const BASE_COLS = [
  { field: "test_case_id", headerName: "ID", width: 130, editable: false },
  { field: "description",  headerName: "Description", width: 320, isLargeText: true },
  { field: "module",       headerName: "Module",      width: 150 },
  { field: "category",     headerName: "Category",    width: 150 },
  {
    field: "priority",
    headerName: "Priority",
    width: 120,
    cellEditor: "agSelectCellEditor",
    cellEditorParams: { values: ["High", "Medium", "Low"] },
  },
  {
    field: "status",
    headerName: "Status",
    width: 150,
    cellEditor: "agSelectCellEditor",
    cellEditorParams: { values: ["Not Executed", "Passed", "Failed", "Blocked"] },
  },
  { field: "preconditions",   headerName: "Preconditions",   width: 260, isLargeText: true },
  { field: "steps",           headerName: "Steps",           width: 300, isLargeText: true },
  { field: "expected_result", headerName: "Expected Result", width: 280, isLargeText: true },
  { field: "notes",           headerName: "Notes",           width: 240, isLargeText: true },
];

export default function TestCasesTab({
  testCases = [],
  projectId,
  project,
  isLoading,
  onStatusChange,
  onAssigneeChange,
  onJumpToIssue,
  showToast,
  onManualCreate,
  onRefresh,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [filterModule,   setFilterModule]   = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);

  // Imported = any test case that is_manual OR has custom_fields data
  const isImported = useMemo(
    () => testCases.some((tc) => tc.is_manual || Object.keys(tc.custom_fields || {}).length > 0),
    [testCases]
  );

  const filtered = useMemo(() => {
    let res = testCases || [];
    if (filterModule)   res = res.filter((tc) => tc.module   === filterModule);
    if (filterCategory) res = res.filter((tc) => tc.category === filterCategory);
    return res;
  }, [testCases, filterModule, filterCategory]);

  // ── Handlers for the editable grid (imported projects) ──
  const handleCellChanged = useCallback(async (event) => {
    const row = event.data;
    if (!row.id) return;
    try {
      await updateTestCase(projectId, row.id, {
        description:     row.description,
        module:          row.module,
        category:        row.category,
        priority:        row.priority,
        status:          row.status,
        preconditions:   row.preconditions,
        steps:           row.steps,
        expected_result: row.expected_result,
        notes:           row.notes,
        custom_fields:   row.custom_fields || {},
      });
    } catch {
      showToast?.("Failed to save change", "error");
    }
  }, [projectId, showToast]);

  const handleAddRow = useCallback(async () => {
    try {
      const newTc = await createManualTestCase(projectId, {
        description: "New row",
        module: "General",
        category: "Functional",
        priority: "Medium",
      });
      onManualCreate?.(newTc);
      onRefresh?.();
      showToast?.("Row added!");
    } catch {
      showToast?.("Failed to add row", "error");
    }
  }, [projectId, onManualCreate, onRefresh, showToast]);

  const handleDeleteRow = useCallback(async (row) => {
    if (!row.id) return;
    try {
      await deleteTestCase(projectId, row.id);
      onRefresh?.();
      showToast?.("Row deleted.");
    } catch {
      showToast?.("Failed to delete row", "error");
    }
  }, [projectId, onRefresh, showToast]);

  // ── Empty state ──
  if (!testCases.length) {
    return (
      <div className="base-card p-5 md:p-6">
        <EmptyState
          icon={<Table2 size={22} />}
          title="No test cases yet"
          description="Analyse a workflow above to generate test cases, or create one manually."
          action={
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus size={16} /> Create Test Case
            </button>
          }
        />
        {showCreateModal && (
          <CreateTestCaseModal
            projectId={projectId}
            onClose={() => setShowCreateModal(false)}
            onSuccess={(tc) => onManualCreate?.(tc)}
          />
        )}
      </div>
    );
  }

  // ── Imported project → spreadsheet grid ──
  if (isImported) {
    return (
      <div className="base-card p-4 md:p-5">
        <EditableDataGrid
          rowData={filtered}
          baseColumns={BASE_COLS}
          onCellValueChanged={handleCellChanged}
          onAddRow={handleAddRow}
          onDeleteRow={handleDeleteRow}
          onImport={() => setShowImportModal(true)}
          title={`Test Cases (${testCases.length})`}
          emptyMessage="No test cases match the current filter."
        />

        {showImportModal && (
          <ImportCsvModal
            open={showImportModal}
            onClose={() => setShowImportModal(false)}
            existingProjectId={projectId}
            defaultImportType="test_cases"
            showToast={showToast}
            onImported={() => {
              setShowImportModal(false);
              onRefresh?.();
            }}
          />
        )}
      </div>
    );
  }

  // ── AI-generated project → classic styled table ──
  return (
    <div className="base-card p-5 md:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">Test Cases</h3>
          <p className="mt-0.5 text-xs text-muted">
            {testCases.length} cases · Click a status pill to cycle result.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active filters */}
          {(filterModule || filterCategory) && (
            <div className="flex items-center gap-1.5 mr-1">
              <Filter size={12} className="text-muted" />
              {filterModule && (
                <span className="flex items-center gap-1 bg-signal/10 text-signal text-[11px] px-2 py-0.5 rounded-full">
                  {filterModule}
                  <button onClick={() => setFilterModule(null)}><X size={9} /></button>
                </span>
              )}
              {filterCategory && (
                <span className="flex items-center gap-1 bg-purple-500/10 text-purple-600 text-[11px] px-2 py-0.5 rounded-full">
                  {filterCategory}
                  <button onClick={() => setFilterCategory(null)}><X size={9} /></button>
                </span>
              )}
            </div>
          )}

          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={14} /> Create
          </button>
          <button onClick={() => setShowImportModal(true)} className="btn-secondary">
            <Upload size={14} /> Import
          </button>
          <button
            onClick={() => exportTestCasesCSV(filtered, "BugMind_TestCases")}
            className="btn-secondary"
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {showCreateModal && (
        <CreateTestCaseModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(tc) => onManualCreate?.(tc)}
        />
      )}

      {showImportModal && (
        <ImportCsvModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          existingProjectId={projectId}
          defaultImportType="test_cases"
          showToast={showToast}
          onImported={() => {
            setShowImportModal(false);
            onRefresh?.();
          }}
        />
      )}

      <TestCaseTable
        testCases={filtered}
        projectId={projectId}
        project={project}
        onStatusChange={onStatusChange}
        onAssigneeChange={onAssigneeChange}
        onJumpToIssue={onJumpToIssue}
        onFilterModule={setFilterModule}
        onFilterCategory={setFilterCategory}
      />
    </div>
  );
}
