import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Plus, Trash2, Download, Search, X, Upload, Edit2, AlertTriangle, Settings2, ChevronDown, RotateCcw } from "lucide-react";

// Register all AG Grid Community modules (enables editing, tooltips, CSV export, etc.)
ModuleRegistry.registerModules([AllCommunityModule]);

import ConfirmDialog from "./ConfirmDialog";

// Delete button cell renderer — must be a named component for AG Grid v31+
function DeleteButtonRenderer({ data, context }) {
  return (
    <button
      onClick={() => context?.onDeleteRow && context.onDeleteRow(data)}
      className="flex items-center justify-center w-full h-full text-muted hover:text-red-500 transition-colors"
      title="Delete row"
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <Trash2 size={13} />
    </button>
  );
}

// Professional dark floating tooltip for AG Grid
function CustomTooltip({ value, valueFormatted, data, colDef }) {
  let val = valueFormatted ?? value;
  if (!val && colDef?.field?.startsWith("cf_")) {
    const rawKey = colDef.field.slice(3);
    val = data?.custom_fields?.[rawKey];
  }
  if (!val || String(val).trim() === "") return null;

  return (
    <div className="bg-slate-900/95 text-slate-100 text-xs px-3 py-2 rounded-xl shadow-2xl border border-slate-700/80 max-w-md leading-relaxed whitespace-pre-wrap break-words z-[99999] pointer-events-none backdrop-blur-md">
      {String(val)}
    </div>
  );
}

export default function EditableDataGrid({
  rowData = [],
  baseColumns = [],
  onCellValueChanged,
  onAddRow,
  onDeleteRow,
  onImport,
  onRenameColumn,
  onRemoveColumn,
  title = "Tracker",
  emptyMessage = "No data yet. Click + Add Row to get started.",
}) {
  const gridRef = useRef(null);
  const [customColumns, setCustomColumns] = useState([]);
  const [newColName, setNewColName] = useState("");
  const [showAddColModal, setShowAddColModal] = useState(false);
  const [quickFilter, setQuickFilter] = useState("");

  // Manage Columns Dropdown
  const [showManageMenu, setShowManageMenu] = useState(false);
  const manageMenuRef = useRef(null);

  // Hidden & Renamed Columns Persistence
  const storageTitleKey = title.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(`bugmind_hidden_cols_${storageTitleKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [renamedHeaders, setRenamedHeaders] = useState(() => {
    try {
      const saved = localStorage.getItem(`bugmind_renamed_cols_${storageTitleKey}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`bugmind_hidden_cols_${storageTitleKey}`, JSON.stringify(hiddenColumns));
    } catch {}
  }, [hiddenColumns, storageTitleKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`bugmind_renamed_cols_${storageTitleKey}`, JSON.stringify(renamedHeaders));
    } catch {}
  }, [renamedHeaders, storageTitleKey]);

  // Modals for Column Rename & Remove
  const [renameTargetKey, setRenameTargetKey] = useState(null);
  const [renameNewName, setRenameNewName] = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);

  const [removeTargetKey, setRemoveTargetKey] = useState(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  useEffect(() => {
    function handleClickOutside(e) {
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target)) {
        setShowManageMenu(false);
      }
    }
    if (showManageMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showManageMenu]);

  // Auto-detect any existing custom_fields keys from the rowData
  const detectedCustomKeys = useMemo(() => {
    const seen = new Set();
    rowData.forEach((row) => {
      if (row.custom_fields && typeof row.custom_fields === "object") {
        Object.keys(row.custom_fields).forEach((k) => {
          if (k !== "solved") seen.add(k);
        });
      }
    });
    return Array.from(seen);
  }, [rowData]);

  const allCustomKeys = useMemo(() => {
    const combined = new Set([...detectedCustomKeys, ...customColumns]);
    return Array.from(combined);
  }, [detectedCustomKeys, customColumns]);

  // System ID columns that MUST remain to preserve row identification
  const nonRemovableKeys = ["bug_id", "test_case_id", "_delete"];

  // All columns list for column manager
  const allColumnsList = useMemo(() => {
    const list = [];
    baseColumns.forEach((col) => {
      if (!nonRemovableKeys.includes(col.field)) {
        list.push({ key: col.field, label: col.headerName || col.field, isCustom: false });
      }
    });
    allCustomKeys.forEach((key) => {
      list.push({ key: key, label: key, isCustom: true });
    });
    return list;
  }, [baseColumns, allCustomKeys]);

  const activeColumnsList = useMemo(() => {
    return allColumnsList.filter((col) => !hiddenColumns.includes(col.key) && !hiddenColumns.includes(`cf_${col.key}`));
  }, [allColumnsList, hiddenColumns]);

  const removedColumnsList = useMemo(() => {
    return allColumnsList.filter((col) => hiddenColumns.includes(col.key) || hiddenColumns.includes(`cf_${col.key}`));
  }, [allColumnsList, hiddenColumns]);

  const columnDefs = useMemo(() => {
    const cols = [];

    baseColumns.forEach((col) => {
      if (hiddenColumns.includes(col.field)) return;
      const isLarge = col.isLargeText === true;
      const header = renamedHeaders[col.field] || col.headerName || col.field;
      cols.push({
        field: col.field,
        headerName: header,
        editable: col.editable !== false,
        width: col.width || 180,
        minWidth: col.minWidth || 100,
        cellEditor: isLarge ? "agLargeTextCellEditor" : (col.cellEditor || "agTextCellEditor"),
        cellEditorPopup: isLarge ? true : false,
        cellEditorParams: isLarge
          ? { rows: 8, cols: 60, maxLength: 10000 }
          : col.cellEditorParams,
        valueGetter: col.valueGetter,
        valueSetter: col.valueSetter || ((params) => {
          params.data[col.field] = params.newValue;
          return true;
        }),
        tooltipComponent: "CustomTooltip",
        tooltipValueGetter: (params) => String(params.valueFormatted ?? params.value ?? ""),
        wrapText: false,
        autoHeight: false,
      });
    });

    // Extra columns from custom_fields JSON
    allCustomKeys.forEach((key) => {
      const fullFieldKey = `cf_${key}`;
      if (hiddenColumns.includes(key) || hiddenColumns.includes(fullFieldKey)) return;
      const header = renamedHeaders[key] || renamedHeaders[fullFieldKey] || key;
      cols.push({
        field: fullFieldKey,
        headerName: header,
        editable: true,
        width: 180,
        minWidth: 120,
        cellEditor: "agTextCellEditor",
        tooltipComponent: "CustomTooltip",
        tooltipValueGetter: (params) => String(params.data?.custom_fields?.[key] ?? params.value ?? ""),
        wrapText: false,
        valueGetter: (params) => params.data?.custom_fields?.[key] ?? "",
        valueSetter: (params) => {
          if (!params.data.custom_fields) params.data.custom_fields = {};
          params.data.custom_fields[key] = params.newValue;
          return true;
        },
      });
    });

    // Delete action column
    cols.push({
      headerName: "",
      field: "_delete",
      width: 46,
      minWidth: 46,
      maxWidth: 46,
      editable: false,
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right",
      cellRenderer: "DeleteButtonRenderer",
    });

    return cols;
  }, [baseColumns, allCustomKeys, hiddenColumns, renamedHeaders]);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      tooltipComponent: "CustomTooltip",
      tooltipValueGetter: (params) => String(params.valueFormatted ?? params.value ?? ""),
      cellEditorParams: {
        maxLength: 10000,
      },
    }),
    []
  );

  const gridComponents = useMemo(
    () => ({
      DeleteButtonRenderer,
      CustomTooltip,
    }),
    []
  );

  const gridContext = useMemo(() => ({ onDeleteRow }), [onDeleteRow]);

  const handleExportCsv = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `${title.toLowerCase().replace(/\s+/g, "_")}.csv`,
      });
    }
  }, [title]);

  const handleAddColumnSubmit = (e) => {
    e.preventDefault();
    const trimmed = newColName.trim();
    if (!trimmed) return;
    if (!customColumns.includes(trimmed) && !detectedCustomKeys.includes(trimmed)) {
      setCustomColumns((prev) => [...prev, trimmed]);
    }
    setNewColName("");
    setShowAddColModal(false);
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    const targetKey = renameTargetKey;
    const trimmedNew = renameNewName.trim();

    // Synchronously close modal & unmount backdrop
    setShowRenameModal(false);
    setRenameTargetKey(null);
    setRenameNewName("");

    if (!trimmedNew || !targetKey) return;

    setRenamedHeaders((prev) => ({ ...prev, [targetKey]: trimmedNew }));

    if (onRenameColumn) {
      try {
        await onRenameColumn(targetKey, trimmedNew);
      } catch (err) {
        console.error("[EditableDataGrid] Error in onRenameColumn:", err);
      }
    }
  };

  const handleRemoveConfirm = async () => {
    const targetKey = removeTargetKey;

    // Synchronously close modal & unmount backdrop immediately
    setShowRemoveModal(false);
    setRemoveTargetKey(null);

    if (!targetKey) return;

    // Instantly hide column locally
    setHiddenColumns((prev) => [...prev, targetKey, `cf_${targetKey}`]);

    if (onRemoveColumn) {
      try {
        await onRemoveColumn(targetKey);
      } catch (err) {
        console.error("[EditableDataGrid] Error in onRemoveColumn:", err);
      }
    }
  };

  const handleRestoreColumn = (key) => {
    setHiddenColumns((prev) => prev.filter((k) => k !== key && k !== `cf_${key}`));
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface px-4 py-2.5 rounded-xl border border-hairline">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{title}</span>
          {rowData.length > 0 && (
            <span className="text-xs font-medium text-white bg-signal px-1.5 py-0.5 rounded-full">
              {rowData.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick search */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-muted" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Search…"
              className="text-xs pl-7 pr-6 py-1.5 border border-hairline rounded-lg bg-white text-ink focus:outline-none focus:border-signal w-36"
            />
            {quickFilter && (
              <button
                onClick={() => setQuickFilter("")}
                className="absolute right-2 text-muted hover:text-ink"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Manage Columns Dropdown */}
          <div className="relative" ref={manageMenuRef}>
            <button
              onClick={() => setShowManageMenu((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-medium bg-paper hover:bg-hairline px-3 py-1.5 rounded-lg text-ink transition-colors border border-hairline"
              title="Manage Spreadsheet Columns"
            >
              <Settings2 size={13} /> Columns <ChevronDown size={11} />
            </button>

            {showManageMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-hairline rounded-xl shadow-xl z-50 py-2 flex flex-col gap-1 text-xs">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-hairline pb-1">
                  Spreadsheet Columns ({activeColumnsList.length})
                </div>

                <div className="max-h-56 overflow-y-auto flex flex-col py-1">
                  {activeColumnsList.map((col) => {
                    const currentHeaderName = renamedHeaders[col.key] || col.label;
                    return (
                      <div
                        key={col.key}
                        className="px-3 py-1.5 flex items-center justify-between hover:bg-paper transition-colors group"
                      >
                        <span className="truncate font-medium text-ink max-w-[130px]" title={currentHeaderName}>
                          {currentHeaderName}
                        </span>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setShowManageMenu(false);
                              setRenameTargetKey(col.key);
                              setRenameNewName(currentHeaderName);
                              setShowRenameModal(true);
                            }}
                            className="p-1 rounded hover:bg-hairline text-muted hover:text-signal transition"
                            title={`Rename "${currentHeaderName}"`}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowManageMenu(false);
                              setRemoveTargetKey(col.key);
                              setShowRemoveModal(true);
                            }}
                            className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-600 transition"
                            title={`Remove "${currentHeaderName}"`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {removedColumnsList.length > 0 && (
                    <>
                      <div className="px-3 py-1 mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted border-t border-hairline pt-1.5">
                        Removed Columns ({removedColumnsList.length})
                      </div>
                      {removedColumnsList.map((col) => (
                        <div
                          key={col.key}
                          className="px-3 py-1 flex items-center justify-between hover:bg-paper transition-colors text-muted"
                        >
                          <span className="truncate line-through max-w-[130px]">{col.label}</span>
                          <button
                            type="button"
                            onClick={() => handleRestoreColumn(col.key)}
                            className="p-1 text-signal hover:bg-signal/10 rounded transition flex items-center gap-1 text-[11px] font-medium"
                            title={`Restore "${col.label}"`}
                          >
                            <RotateCcw size={11} /> Restore
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAddColModal(true)}
            className="flex items-center gap-1.5 text-xs font-medium bg-paper hover:bg-hairline px-3 py-1.5 rounded-lg text-ink transition-colors border border-hairline"
          >
            <Plus size={13} /> Column
          </button>

          <button
            onClick={onAddRow}
            className="flex items-center gap-1.5 text-xs font-medium bg-signal text-white hover:bg-signal/90 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Row
          </button>

          {onImport && (
            <button
              onClick={onImport}
              className="flex items-center gap-1.5 text-xs font-medium bg-paper hover:bg-hairline px-3 py-1.5 rounded-lg text-ink transition-colors border border-hairline"
              title="Import from CSV or Excel"
            >
              <Upload size={13} /> Import
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs font-medium bg-paper hover:bg-hairline px-2.5 py-1.5 rounded-lg text-muted hover:text-ink transition-colors border border-hairline"
            title="Export as CSV"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div
        className="ag-theme-alpine w-full rounded-xl border border-hairline shadow-sm"
        style={{ minHeight: rowData.length === 0 ? 220 : 200 }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          quickFilterText={quickFilter}
          suppressMovableColumns={false}
          singleClickEdit={false}
          enableCellTextSelection={true}
          suppressClickEdit={false}
          stopEditingWhenCellsLoseFocus={true}
          tooltipShowDelay={300}
          tooltipHideDelay={5000}
          context={gridContext}
          components={gridComponents}
          noRowsOverlayComponent={() => (
            <span className="text-muted text-sm">{emptyMessage}</span>
          )}
          domLayout="autoHeight"
        />
      </div>

      {/* ── Add Column Modal ── */}
      {showAddColModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-32 bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-hairline p-5 shadow-2xl flex flex-col gap-4">
            <div>
              <h4 className="text-sm font-bold text-ink">Add Custom Column</h4>
              <p className="text-xs text-muted mt-1">
                Name your new column. It appears for every row.
              </p>
            </div>
            <form onSubmit={handleAddColumnSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="e.g. Environment, Found By, Build…"
                className="w-full text-sm border border-hairline rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-signal"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAddColModal(false); setNewColName(""); }}
                  className="px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-signal text-white rounded-lg hover:bg-signal/90"
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rename Column Modal ── */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-32 bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-hairline p-5 shadow-2xl flex flex-col gap-4">
            <div>
              <h4 className="text-sm font-bold text-ink">Rename Column</h4>
              <p className="text-xs text-muted mt-1">
                Enter a new header name for <strong>"{renameTargetKey}"</strong>.
              </p>
            </div>
            <form onSubmit={handleRenameSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                className="w-full text-sm border border-hairline rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-signal"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowRenameModal(false); setRenameTargetKey(null); }}
                  className="px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-signal text-white rounded-lg hover:bg-signal/90"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Remove Column Confirmation Dialog ── */}
      <ConfirmDialog
        open={showRemoveModal}
        title="Remove Column?"
        message={`Are you sure you want to remove the column "${removeTargetKey}"? This will remove this field and all its associated data from the spreadsheet.`}
        confirmText="Remove Column"
        danger={true}
        onConfirm={handleRemoveConfirm}
        onCancel={() => { setShowRemoveModal(false); setRemoveTargetKey(null); }}
      />
    </div>
  );
}
