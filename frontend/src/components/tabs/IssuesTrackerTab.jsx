import React, { useState, useMemo, useCallback } from "react";
import EditableDataGrid from "../shared/EditableDataGrid";
import ImportCsvModal from "../csv/ImportCsvModal";
import { updateIssue, deleteIssue, saveIssue } from "../../services/issueApi";
import { updateTestCase, deleteTestCase, createManualTestCase } from "../../services/testCaseApi";

export default function IssuesTrackerTab({
  issues = [],
  testCases = [],
  projectId,
  showToast,
  onRefresh,
}) {
  // Determine if we are tracking direct issues or mapped test cases
  const hasDirectIssues = issues && issues.length > 0;

  const displayRows = useMemo(() => {
    if (hasDirectIssues) {
      // Normalize direct issues – backend may store notes/solved in custom_fields
      return issues.map((issue, idx) => {
        const cf = issue.custom_fields || {};
        let bugId = issue.bug_id;
        if (!bugId || bugId === String(issue.id)) {
          bugId = `BUG-${String(idx + 1).padStart(3, "0")}`;
        }
        return {
          ...issue,
          bug_id: bugId,
          notes: issue.notes ?? cf.notes ?? "",
          solved: issue.solved ?? cf.solved ?? "No",
          custom_fields: cf,
        };
      });
    }
    return testCases.map((tc, idx) => {
      // Derive distinct initial severity based on priority level or custom fields if available
      const rawSeverity = tc.custom_fields?.severity || (
        tc.priority === "High" ? "Critical" : tc.priority === "Medium" ? "High" : "Medium"
      );
      let formattedBugId = tc.test_case_id;
      if (!formattedBugId || formattedBugId === String(tc.id) || formattedBugId === tc.id) {
        formattedBugId = `TC-${String(idx + 1).padStart(3, '0')}`;
      }
      return {
        id: tc.id,
        bug_id: formattedBugId,
        title: tc.description || "Test Case Issue",
        description: tc.description || "",
        severity: rawSeverity,
        priority: tc.priority || "Medium",
        status: tc.status === "Failed" ? "Open" : tc.status === "Passed" ? "Closed" : "In Progress",
        solved: tc.status === "Passed" ? "Yes" : tc.status === "Failed" ? "No" : "Retest",
        reproduction_steps: tc.steps || "",
        expected_result: tc.expected_result || "",
        actual_result: tc.actual_result || "",
        notes: tc.notes || "",
        custom_fields: tc.custom_fields || {},
        _is_mapped_testcase: true,
      };
    });
  }, [issues, testCases, hasDirectIssues]);

  const baseColumns = useMemo(
    () => [
      { field: "bug_id", headerName: "Bug ID", width: 120, editable: false },
      { field: "title", headerName: "Title / Summary", width: 280, isLargeText: true },
      { field: "description", headerName: "Description", width: 300, isLargeText: true },
      {
        field: "severity",
        headerName: "Severity",
        width: 130,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Critical", "High", "Medium", "Low"] },
      },
      {
        field: "priority",
        headerName: "Priority",
        width: 130,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["High", "Medium", "Low"] },
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Open", "In Progress", "Resolved", "Closed", "Fail", "Observation", "Passed"] },
      },
      {
        field: "solved",
        headerName: "Solved",
        width: 120,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Yes", "No", "Retest"] },
        valueGetter: (params) => params.data?.solved || params.data?.custom_fields?.solved || "No",
        valueSetter: (params) => {
          params.data.solved = params.newValue;
          if (!params.data.custom_fields) params.data.custom_fields = {};
          params.data.custom_fields.solved = params.newValue;
          return true;
        },
      },
      { field: "reproduction_steps", headerName: "Reproduction Steps", width: 300, isLargeText: true },
      { field: "expected_result", headerName: "Expected Result", width: 250, isLargeText: true },
      { field: "actual_result", headerName: "Actual Result", width: 250, isLargeText: true },
      { field: "notes", headerName: "Dev Remarks", width: 240, isLargeText: true },
    ],
    []
  );

  const handleCellValueChanged = useCallback(
    async (event) => {
      const row = event.data;
      if (!row.id) return;

      try {
        if (row._is_mapped_testcase) {
          // Map solved back to test case status
          let tcStatus = row.status;
          if (row.solved === "Yes") tcStatus = "Passed";
          else if (row.solved === "No") tcStatus = "Failed";

          await updateTestCase(projectId, row.id, {
            description: row.title || row.description,
            priority: row.priority || row.severity,
            status: tcStatus,
            steps: row.reproduction_steps,
            expected_result: row.expected_result,
            actual_result: row.actual_result,
            notes: row.notes,
            custom_fields: row.custom_fields || {},
          });
        } else {
          await updateIssue(projectId, row.id, row);
        }
        if (showToast) showToast("Updated successfully!");
      } catch (err) {
        if (showToast) showToast("Failed to save changes", "error");
      }
    },
    [projectId, showToast]
  );

  const handleAddRow = useCallback(async () => {
    try {
      if (hasDirectIssues) {
        await saveIssue(projectId, {
          title: "New Reported Bug",
          description: "Describe the bug here",
          severity: "Medium",
          priority: "Medium",
          status: "Open",
        });
      } else {
        await createManualTestCase(projectId, {
          description: "New Issue / Test Case",
          module: "General",
          category: "Bug",
          priority: "Medium",
          status: "Not Executed",
        });
      }
      if (onRefresh) onRefresh();
      if (showToast) showToast("Added new row!");
    } catch (err) {
      if (showToast) showToast("Failed to add row", "error");
    }
  }, [projectId, hasDirectIssues, onRefresh, showToast]);

  const handleDeleteRow = useCallback(
    async (row) => {
      if (!row.id) return;
      try {
        if (row._is_mapped_testcase) {
          await deleteTestCase(projectId, row.id);
        } else {
          await deleteIssue(projectId, row.id);
        }
        if (onRefresh) onRefresh();
        if (showToast) showToast("Deleted row!");
      } catch (err) {
        if (showToast) showToast("Failed to delete row", "error");
      }
    },
    [projectId, onRefresh, showToast]
  );

  const handleRenameColumn = useCallback(
    async (oldKey, newKey) => {
      const trimmedOld = (oldKey || "").trim();
      const trimmedNew = (newKey || "").trim();
      if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return;

      try {
        if (hasDirectIssues) {
          await Promise.all(
            issues.map(async (issue) => {
              const cf = { ...(issue.custom_fields || {}) };
              if (trimmedOld in cf) {
                cf[trimmedNew] = cf[trimmedOld];
                delete cf[trimmedOld];
                await updateIssue(projectId, issue.id, { custom_fields: cf });
              }
            })
          );
        } else {
          await Promise.all(
            testCases.map(async (tc) => {
              const cf = { ...(tc.custom_fields || {}) };
              if (trimmedOld in cf) {
                cf[trimmedNew] = cf[trimmedOld];
                delete cf[trimmedOld];
                await updateTestCase(projectId, tc.id, { custom_fields: cf });
              }
            })
          );
        }
        if (onRefresh) onRefresh();
        if (showToast) showToast(`Renamed column "${trimmedOld}" to "${trimmedNew}"`);
      } catch (err) {
        if (showToast) showToast("Failed to rename column", "error");
      }
    },
    [issues, testCases, hasDirectIssues, projectId, onRefresh, showToast]
  );

  const handleRemoveColumn = useCallback(
    async (colKey) => {
      const key = (colKey || "").trim();
      if (!key) return;

      try {
        if (hasDirectIssues) {
          await Promise.all(
            issues.map(async (issue) => {
              const cf = { ...(issue.custom_fields || {}) };
              if (key in cf) {
                delete cf[key];
                await updateIssue(projectId, issue.id, { custom_fields: cf });
              }
            })
          );
        } else {
          await Promise.all(
            testCases.map(async (tc) => {
              const cf = { ...(tc.custom_fields || {}) };
              if (key in cf) {
                delete cf[key];
                await updateTestCase(projectId, tc.id, { custom_fields: cf });
              }
            })
          );
        }
        if (onRefresh) onRefresh();
        if (showToast) showToast(`Removed column "${key}"`);
      } catch (err) {
        if (showToast) showToast("Failed to remove column", "error");
      }
    },
    [issues, testCases, hasDirectIssues, projectId, onRefresh, showToast]
  );

  const [showImportModal, setShowImportModal] = useState(false);

  return (
    <div className="base-card p-4 md:p-5">
      <EditableDataGrid
        rowData={displayRows}
        baseColumns={baseColumns}
        onCellValueChanged={handleCellValueChanged}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        onImport={() => setShowImportModal(true)}
        onRenameColumn={handleRenameColumn}
        onRemoveColumn={handleRemoveColumn}
        title="Issues / Bug Tracker Spreadsheet"
        emptyMessage="No issues recorded. Click + Row to add a new issue or Import to upload a CSV/Excel file."
      />

      {showImportModal && (
        <ImportCsvModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          existingProjectId={projectId}
          defaultImportType="issues"
          showToast={showToast}
          onImported={() => {
            setShowImportModal(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
