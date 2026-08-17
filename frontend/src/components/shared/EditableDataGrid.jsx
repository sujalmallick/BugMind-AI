import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Plus, Trash2, Download, Search, X, Upload, Edit2, AlertTriangle, Settings2, ChevronDown } from "lucide-react";

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

  // Non-essential custom/imported columns eligible for rename/remove
  const removableCustomKeys = useMemo(() => {
    const systemEssential = ["bug_id", "test_case_id", "status", "severity", "priority", "solved", "_delete"];
    return allCustomKeys.filter((k) => !systemEssential.includes(k));
  }, [allCustomKeys]);

  const columnDefs = useMemo(() => {
    const cols = baseColumns.map((col) => ({
      field: col.field,
      headerName: col.headerName || col.field,
      editable: col.editable !== false,
      width: col.width || 180,
      minWidth: col.minWidth || 100,
      cellEditor: col.cellEditor || "agTextCellEditor",
      cellEditorParams: col.cellEditorParams,
      valueGetter: col.valueGetter,
      valueSetter: col.valueSetter,
      cellRenderer: col.cellRenderer ?? undefined,
      tooltipValueGetter: (params) => params.value,
      tooltipField: col.field,
      wrapText: false,
      autoHeight: false,
    }));

    // Extra columns from custom_fields JSON
    allCustomKeys.forEach((key) => {
      cols.push({
        field: `cf_${key}`,
        headerName: key,
        editable: true,
        width: 180,
        minWidth: 120,
        cellEditor: "agTextCellEditor",
        tooltipValueGetter: (params) => params.value,
        tooltipField: `cf_${key}`,
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
  }, [baseColumns, allCustomKeys]);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      tooltipValueGetter: (params) => params.value,
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

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    const trimmedNew = renameNewName.trim();
    if (!trimmedNew || !renameTargetKey) return;
    if (onRenameColumn) {
      onRenameColumn(renameTargetKey, trimmedNew);
    }
    setShowRenameModal(false);
    setRenameTargetKey(null);
    setRenameNewName("");
  };

  const handleRemoveConfirm = () => {
    if (!removeTargetKey) return;
    if (onRemoveColumn) {
      onRemoveColumn(removeTargetKey);
    }
    setShowRemoveModal(false);
    setRemoveTargetKey(null);
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
          {removableCustomKeys.length > 0 && (
            <div className="relative" ref={manageMenuRef}>
              <button
                onClick={() => setShowManageMenu((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-medium bg-paper hover:bg-hairline px-3 py-1.5 rounded-lg text-ink transition-colors border border-hairline"
                title="Manage Custom & Imported Columns"
              >
                <Settings2 size={13} /> Columns <ChevronDown size={11} />
              </button>

              {showManageMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-hairline rounded-xl shadow-xl z-50 py-2 flex flex-col gap-1 text-xs">
                  <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-hairline pb-1">
                    Manage Columns
                  </div>
                  <div className="max-h-48 overflow-y-auto flex flex-col py-1">
                    {removableCustomKeys.map((key) => (
                      <div
                        key={key}
                        className="px-3 py-1.5 flex items-center justify-between hover:bg-paper transition-colors group"
                      >
                        <span className="truncate font-medium text-ink max-w-[120px]">{key}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowManageMenu(false);
                              setRenameTargetKey(key);
                              setRenameNewName(key);
                              setShowRenameModal(true);
                            }}
                            className="p-1 rounded hover:bg-hairline text-muted hover:text-signal transition"
                            title={`Rename ${key}`}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowManageMenu(false);
                              setRemoveTargetKey(key);
                              setShowRemoveModal(true);
                            }}
                            className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-600 transition"
                            title={`Remove ${key}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
          rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: false }}
          suppressMovableColumns={false}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          enableBrowserTooltips={true}
          context={gridContext}
          components={{ DeleteButtonRenderer }}
          noRowsOverlayComponent={() => (
            <span className="text-muted text-sm">{emptyMessage}</span>
          )}
          domLayout="autoHeight"
        />
      </div>

      {/* ── Add Column Modal ── */}
      {showAddColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-hairline p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-ink">Remove Column?</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Are you sure you want to remove the column <strong>"{removeTargetKey}"</strong>? This will remove this field from all rows permanently.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
              <button
                type="button"
                onClick={() => { setShowRemoveModal(false); setRemoveTargetKey(null); }}
                className="px-4 py-2 text-xs font-medium border border-hairline rounded-lg text-ink hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveConfirm}
                className="px-4 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Remove Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
