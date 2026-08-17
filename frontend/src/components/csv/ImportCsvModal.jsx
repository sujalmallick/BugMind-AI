import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  X,
  Upload,
  FileSpreadsheet,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { bulkImportTestCases, bulkImportIssues } from "../../api/csvApi";
import { createProject as createProjectApi, getProjects as getProjectsApi } from "../../services/projectApi";

// ── Field definitions ─────────────────────────────────────────────────────────
const TEST_CASE_FIELDS = [
  { key: "description", label: "Description", required: true },
  { key: "module", label: "Module" },
  { key: "category", label: "Category" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "preconditions", label: "Preconditions" },
  { key: "steps", label: "Steps" },
  { key: "expected_result", label: "Expected Result" },
  { key: "actual_result", label: "Actual Result" },
  { key: "notes", label: "Dev Remarks / Notes" },
  { key: "test_case_id", label: "Test Case ID (optional)" },
];

const ISSUE_FIELDS = [
  { key: "title", label: "Title", required: true },
  { key: "description", label: "Description" },
  { key: "severity", label: "Severity" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "reproduction_steps", label: "Reproduction Steps" },
  { key: "expected_result", label: "Expected Result" },
  { key: "actual_result", label: "Actual Result" },
  { key: "notes", label: "Dev Remarks" },
  { key: "bug_id", label: "Bug ID (optional)" },
];

// Steps: SETUP → UPLOAD → MAP → PREVIEW → DONE
const STEP = {
  SETUP: "setup",
  UPLOAD: "upload",
  MAP: "map",
  PREVIEW: "preview",
  DONE: "done",
};

const ALL_STEPS = [STEP.SETUP, STEP.UPLOAD, STEP.MAP, STEP.PREVIEW, STEP.DONE];

export default function ImportCsvModal({
  open,
  onClose,
  showToast = () => {},
  onImported,
  // When set, skip SETUP — import into an already-existing project
  existingProjectId = null,
  existingProjectName = null,
  defaultImportType = null,
}) {
  const navigate = useNavigate();
  // If an existing project is provided, start at UPLOAD (skip SETUP)
  const initialStep = existingProjectId ? STEP.UPLOAD : STEP.SETUP;
  const [step, setStep] = useState(initialStep);
  const [importType, setImportType] = useState(defaultImportType || "issues");
  const [projectName, setProjectName] = useState(existingProjectName || "");
  const [projectDesc, setProjectDesc] = useState("");
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  // Pre-fill with existing project id so handleImport skips creation
  const [createdProjectId, setCreatedProjectId] = useState(existingProjectId);
  // Track whether the MAP step was skipped (jumped UPLOAD→PREVIEW)
  const [mapWasSkipped, setMapWasSkipped] = useState(false);

  const fields = importType === "issues" ? ISSUE_FIELDS : TEST_CASE_FIELDS;

  function reset() {
    setStep(existingProjectId ? STEP.UPLOAD : STEP.SETUP);
    setImportType(defaultImportType || "issues");
    setProjectName(existingProjectName || "");
    setProjectDesc("");
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setImporting(false);
    setResult(null);
    setError(null);
    setIsDragging(false);
    setCreatedProjectId(existingProjectId);
    setMapWasSkipped(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function autoDetectMapping(headers) {
    const detected = {};
    const fieldDefs = importType === "issues" ? ISSUE_FIELDS : TEST_CASE_FIELDS;
    fieldDefs.forEach(({ key, label }) => {
      const keywords = [key.toLowerCase(), label.toLowerCase()];
      const match = headers.find((h) =>
        keywords.some((k) => h.toLowerCase().includes(k))
      );
      if (match) detected[key] = match;
    });
    return detected;
  }

  // Skip the MAP step if all required fields are already matched by auto-detection
  function resolveNextStep(detected) {
    const fieldDefs = importType === "issues" ? ISSUE_FIELDS : TEST_CASE_FIELDS;
    const requiredKeys = fieldDefs.filter((f) => f.required).map((f) => f.key);
    const allRequiredMapped = requiredKeys.every((k) => detected[k]);
    const skipping = allRequiredMapped;
    setMapWasSkipped(skipping);
    return skipping ? STEP.PREVIEW : STEP.MAP;
  }

  function parseFile(file) {
    setError(null);
    const fileName = file.name.toLowerCase();

    // Handle Excel files
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to JSON array (with headers as keys)
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          
          if (!jsonData || !jsonData.length) {
            setError("The Excel file is empty or has no valid rows.");
            return;
          }

          // Reliably extract headers directly from the first row of the sheet
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const headers = (rawRows[0] || []).map(String).filter(Boolean);
          
          if (!headers.length) {
            setError("Could not read column headers. Make sure the first row contains headers.");
            return;
          }

          const detected = autoDetectMapping(headers);
          setCsvHeaders(headers);
          setCsvRows(jsonData);
          setMapping(detected);
          setStep(resolveNextStep(detected));
        } catch (err) {
          setError(`Could not parse Excel file: ${err.message}`);
        }
      };
      reader.onerror = () => setError("Failed to read Excel file.");
      reader.readAsArrayBuffer(file);
      return;
    }

    // Handle CSV files
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data || !res.data.length) {
          setError("The CSV file is empty or has no valid rows.");
          return;
        }
        const headers = (res.meta.fields || []).map(String).filter(Boolean);
        if (!headers.length) {
          setError("Could not read column headers. Make sure the first row contains headers.");
          return;
        }
        const detected = autoDetectMapping(headers);
        setCsvHeaders(headers);
        setCsvRows(res.data);
        setMapping(detected);
        setStep(resolveNextStep(detected));
      },
      error: (err) => {
        setError(`Could not parse CSV file: ${err.message}`);
      },
    });
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      parseFile(file);
      // Reset input value so same file can be re-selected
      e.target.value = "";
    }
  }

  function buildRows() {
    const mappedCsvCols = new Set(Object.values(mapping).filter(Boolean));
    return csvRows
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const obj = {};
        const customFields = {};
        Object.entries(mapping).forEach(([fieldKey, csvCol]) => {
          if (csvCol) obj[fieldKey] = row[csvCol] ?? "";
        });
        Object.keys(row).forEach((colName) => {
          if (!mappedCsvCols.has(colName)) {
            customFields[colName] = row[colName] ?? "";
          }
        });
        if (Object.keys(customFields).length > 0) {
          obj.custom_fields = customFields;
        }
        return obj;
      });
  }

  async function handleImport() {
    console.log("[handleImport] Starting import process...");
    setImporting(true);
    setError(null);
    let targetProjectId = createdProjectId;
    let targetProjectName = projectName.trim();
    console.log("[handleImport] targetProjectId (state):", targetProjectId, "targetProjectName:", targetProjectName);

    try {
      // 1. Create the project (only if not already created during a previous failed attempt)
      if (!targetProjectId) {
        console.log("[handleImport] Creating project:", targetProjectName);
        let saved;
        try {
          saved = await createProjectApi({
            name: targetProjectName,
            description: projectDesc.trim(),
            organization_id: null,
            team_id: null,
          });
        } catch (projectErr) {
          console.error("[handleImport] Project creation API error:", projectErr);
          const status = projectErr?.response?.status;
          const detail = projectErr?.response?.data?.detail;
          if (status === 400 || status === 409) {
            throw new Error(detail || "A project with this name already exists. Please choose a different name.");
          }
          throw projectErr;
        }

        if (!saved?.id) {
          // Backend created the project but response had no id (serialization glitch).
          // Try to recover by looking up the project by name.
          console.warn("[handleImport] saved has no id — attempting recovery by name lookup");
          try {
            const allProjects = await getProjectsApi();
            const found = allProjects.find(
              (p) => p.name.trim().toLowerCase() === targetProjectName.toLowerCase()
            );
            if (found?.id) {
              console.log("[handleImport] Recovered project by name lookup. ID:", found.id);
              targetProjectId = found.id;
              targetProjectName = found.name;
              setCreatedProjectId(targetProjectId);
            } else {
              throw new Error("Failed to create project.");
            }
          } catch (lookupErr) {
            throw new Error("Failed to create project.");
          }
        } else {
          targetProjectId = saved.id;
          targetProjectName = saved.name;
          setCreatedProjectId(targetProjectId);
          console.log("[handleImport] Project created successfully! ID:", targetProjectId);
        }
      } else {
        console.log("[handleImport] Reusing existing project ID:", targetProjectId);
      }

      // 2. Import the CSV rows
      console.log("[handleImport] csvRows in state count:", csvRows.length);
      console.log("[handleImport] Mapping configured:", mapping);
      const rows = buildRows();
      console.log("[handleImport] Built rows payload:", rows);

      let res;
      try {
        if (importType === "issues") {
          console.log("[handleImport] Sending bulkImportIssues request for project:", targetProjectId);
          res = await bulkImportIssues(targetProjectId, rows);
        } else {
          console.log("[handleImport] Sending bulkImportTestCases request for project:", targetProjectId);
          res = await bulkImportTestCases(targetProjectId, rows);
        }
        console.log("[handleImport] Import API success response:", res);
      } catch (importErr) {
        console.error("[handleImport] Import API request failed:", importErr);
        const detail = importErr?.response?.data?.detail;
        if (typeof detail === "string") {
          throw new Error(`Import failed: ${detail}`);
        } else if (Array.isArray(detail)) {
          throw new Error(`Import failed: ${detail.map((d) => `${d.loc ? d.loc.join(".") + ": " : ""}${d.msg}`).join(", ")}`);
        }
        throw new Error(importErr?.message || "Failed to import spreadsheet rows.");
      }

      setResult({ ...res, projectId: targetProjectId, projectName: targetProjectName });
      setStep(STEP.DONE);
      showToast(`Imported ${res.imported} ${importType === "issues" ? "issues" : "test cases"} into "${targetProjectName}"!`);
      if (onImported) onImported();
    } catch (err) {
      console.error("[handleImport] Caught error in import pipeline:", err);
      setError(err.message || "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  const displaySteps = existingProjectId
    ? [STEP.UPLOAD, STEP.MAP, STEP.PREVIEW, STEP.DONE]
    : ALL_STEPS;
  const stepIndex = displaySteps.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-signal/10 p-2">
              <FileSpreadsheet size={18} className="text-signal" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Import Data</h2>
              <p className="text-xs text-muted">
                {step === STEP.SETUP && "Name your project and choose what to import"}
                {step === STEP.UPLOAD && "Upload your spreadsheet (CSV or Excel)"}
                {step === STEP.MAP && "Map your columns to BugMind fields"}
                {step === STEP.PREVIEW && "Preview before importing"}
                {step === STEP.DONE && "All done!"}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-2 text-muted hover:bg-paper hover:text-ink transition">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-4 shrink-0">
          {displaySteps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                stepIndex >= i ? "bg-signal" : "bg-hairline"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Step 1: Setup ── */}
          {step === STEP.SETUP && (
            <div className="space-y-5">
              {/* Project name */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Login Module v2 QA"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm outline-none transition focus:border-signal"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">
                  Description <span className="text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="What is this project about?"
                  rows={2}
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm outline-none transition focus:border-signal resize-none"
                />
              </div>

              {/* Import type */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink">
                  What are you importing?
                </label>
                <div className="flex gap-3">
                  {["issues", "test_cases"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setImportType(t)}
                      className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                        importType === t
                          ? "border-signal bg-signal/5 text-signal"
                          : "border-hairline text-muted hover:border-signal/40"
                      }`}
                    >
                      {t === "issues" ? "🐛 Issues / Bugs" : "🧪 Test Cases"}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Upload ── */}
          {step === STEP.UPLOAD && (
            <div className="space-y-4">
              {/* Drop zone */}
              <label
                htmlFor="csv-file-input"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition py-14 ${
                  isDragging
                    ? "border-signal bg-signal/5"
                    : "border-hairline bg-paper hover:border-signal/50 hover:bg-signal/5"
                }`}
              >
                <div className="rounded-2xl bg-white border border-hairline p-4 shadow-sm">
                  <Upload size={32} className="text-signal" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-ink">
                    Drop your CSV or Excel file here
                  </p>
                  <p className="text-xs text-muted mt-1">
                    or <span className="text-signal font-semibold underline">click to browse</span> — .csv, .xlsx, .xls
                  </p>
                </div>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,.CSV,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="rounded-xl border border-hairline bg-surface p-4 text-xs text-muted space-y-1">
                <p className="font-semibold text-ink text-xs mb-1">💡 Tips for a smooth import</p>
                <p>• Supported formats: CSV, Excel (.xlsx, .xls)</p>
                <p>• First row must be column headers (e.g. "Title", "Description", "Status")</p>
                <p>• For Excel files, BugMind will read data from the first sheet</p>
                <p>• Column names don't need to match exactly — you'll map them in the next step</p>
                <p>• Missing IDs (Bug ID, Test Case ID) are auto-generated</p>
              </div>
            </div>
          )}

          {/* ── Step 3: Map columns ── */}
          {step === STEP.MAP && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Map your columns to BugMind fields. We auto-detected some — review and adjust.
              </p>
              <div className="space-y-2.5">
                {fields.map(({ key, label, required }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-44 shrink-0">
                      <span className="text-sm font-medium text-ink">{label}</span>
                      {required && <span className="ml-1 text-red-400 text-xs">*</span>}
                    </div>
                    <div className="relative flex-1">
                      <select
                        value={mapping[key] || ""}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, [key]: e.target.value || undefined }))
                        }
                        className="w-full appearance-none rounded-lg border border-hairline bg-white px-3 py-2 pr-8 text-sm outline-none transition focus:border-signal"
                      >
                        <option value="">— Skip this field —</option>
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted pt-1">
                Detected <strong>{csvRows.length}</strong> rows ready to import.
              </p>
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Preview ── */}
          {step === STEP.PREVIEW && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Showing <strong>{Math.min(5, csvRows.length)}</strong> of{" "}
                <strong>{csvRows.length}</strong> rows. Importing into project{" "}
                <strong>"{projectName}"</strong>.
              </p>
              <div className="overflow-x-auto rounded-xl border border-hairline">
                <table className="w-full text-xs">
                  <thead className="bg-paper">
                    <tr>
                      {Object.keys(mapping)
                        .filter((k) => mapping[k])
                        .map((k) => (
                          <th key={k} className="px-3 py-2 text-left font-semibold text-muted border-b border-hairline">
                            {fields.find((f) => f.key === k)?.label || k}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {buildRows()
                      .slice(0, 5)
                      .map((row, i) => (
                        <tr key={i} className="border-b border-hairline last:border-0">
                          {Object.keys(mapping)
                            .filter((k) => mapping[k])
                            .map((k) => (
                              <td key={k} className="px-3 py-2 text-ink max-w-[150px] truncate" title={row[k]}>
                                {row[k] || <span className="text-muted italic">empty</span>}
                              </td>
                            ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === STEP.DONE && result && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="rounded-full bg-green-100 p-5">
                <CheckCircle2 size={36} className="text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-ink">Import Complete!</p>
                <p className="text-sm text-muted mt-1">
                  Successfully imported{" "}
                  <strong>{result.imported}</strong>{" "}
                  {importType === "issues" ? "issues" : "test cases"} into{" "}
                  <strong>"{result.projectName}"</strong>.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onClose();
                    reset();
                  }}
                  className="rounded-lg border border-hairline bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-signal"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onClose();
                    reset();
                    navigate(`/project/${result.projectId}/workspace`);
                  }}
                  className="rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-signal-hover"
                >
                  Open Project
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== STEP.DONE && (
          <div className="flex justify-between gap-3 border-t border-hairline px-6 py-4 shrink-0">
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (step === STEP.SETUP || (existingProjectId && step === STEP.UPLOAD)) handleClose();
                else if (step === STEP.UPLOAD) setStep(STEP.SETUP);
                else if (step === STEP.MAP) setStep(STEP.UPLOAD);
                // If MAP was auto-skipped, Back from PREVIEW goes to UPLOAD;
                // otherwise it goes to MAP so the user can adjust mappings.
                else if (step === STEP.PREVIEW) setStep(mapWasSkipped ? STEP.UPLOAD : STEP.MAP);
              }}
              className="btn-secondary"
            >
              {(step === STEP.SETUP || (existingProjectId && step === STEP.UPLOAD)) ? "Cancel" : "← Back"}
            </button>

            {step === STEP.SETUP && (
              <button
                type="button"
                onClick={() => {
                  if (!projectName.trim()) {
                    setError("Please enter a project name.");
                    return;
                  }
                  setError(null);
                  setStep(STEP.UPLOAD);
                }}
                className="btn-primary flex items-center gap-2"
              >
                Next: Upload CSV <ArrowRight size={14} />
              </button>
            )}

            {step === STEP.MAP && (
              <button
                type="button"
                onClick={() => {
                  const required = fields.filter((f) => f.required);
                  const missing = required.filter((f) => !mapping[f.key]);
                  if (missing.length) {
                    setError(`Please map: ${missing.map((f) => f.label).join(", ")}`);
                    return;
                  }
                  setError(null);
                  setStep(STEP.PREVIEW);
                }}
                className="btn-primary flex items-center gap-2"
              >
                Preview <ArrowRight size={14} />
              </button>
            )}

            {step === STEP.PREVIEW && (
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {importing ? (
                  <><Loader2 size={14} className="animate-spin" /> Creating & Importing...</>
                ) : (
                  <><Upload size={14} /> Import {csvRows.length} rows</>
                )}
              </button>
            )}
          </div>
        )}

        {step === STEP.DONE && (
          <div className="flex justify-end gap-3 border-t border-hairline px-6 py-4 shrink-0">
            <button onClick={handleClose} className="btn-primary">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
