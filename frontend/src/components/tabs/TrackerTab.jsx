import {
  CheckCircle2,
  XCircle,
  Clock3,
  Ban,
  ClipboardList,
  Search,
  Download,
} from "lucide-react";
import { useMemo, useState } from "react";
import EmptyState from "../shared/EmptyState";
import TrackerTable from "../shared/TrackerTable";
import { exportTestCasesCSV } from "../../lib/exportCSV";

function MetricCard({ icon, label, value, tone }) {
  return (
    <div className="group base-card p-4 hover:-translate-y-1">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="transition-transform duration-300 ease-out group-hover:scale-110">{icon}</span>
        <span>{label}</span>
      </div>

      <p className={`text-3xl font-semibold leading-none ${tone}`}>{value}</p>
    </div>
  );
}

export default function TrackerTab({
  testCases = [],
  onStatusChange,
  onJumpToIssue,
  showToast,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const hasTestCases = testCases.length > 0;

  const counts = useMemo(() => {
    const result = {
      total: testCases.length,
      passed: 0,
      failed: 0,
      blocked: 0,
      pending: 0,
    };

    testCases.forEach((tc) => {
      const status = (tc.status || "").toLowerCase().trim();

      if (status === "passed" || status === "pass") {
        result.passed++;
      } else if (status === "failed" || status === "fail") {
        result.failed++;
      } else if (status === "blocked") {
        result.blocked++;
      } else {
        result.pending++;
      }
    });

    return result;
  }, [testCases]);

  const executed =
    counts.passed +
    counts.failed +
    counts.blocked;

  const progress =
    counts.total === 0
      ? 0
      : Math.round((executed / counts.total) * 100);

  const filteredTestCases = useMemo(() => {
    let filtered = [...testCases];

    // Search
    if (search.trim()) {
      const query = search.toLowerCase();

      filtered = filtered.filter((tc) =>
        [
          tc.id,
          tc.description,
          tc.module,
          tc.category,
          tc.priority,
          tc.status,
        ]
          .filter(Boolean)
          .some((value) =>
            value.toString().toLowerCase().includes(query)
          )
      );
    }

    // Status Filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((tc) => {
        const status = (tc.status || "").toLowerCase().trim();

        switch (statusFilter) {
          case "passed":
            return status === "passed" || status === "pass";

          case "failed":
            return status === "failed" || status === "fail";

          case "blocked":
            return status === "blocked";

          case "pending":
            // Everything not executed
            return ![
              "passed",
              "pass",
              "failed",
              "fail",
              "blocked",
            ].includes(status);

          default:
            return true;
        }
      });
    }
    if (priorityFilter !== "all") {
      filtered = filtered.filter((tc) => {
        const priority = (tc.priority || "").toLowerCase().trim();

        return priority === priorityFilter;
      });
    }

    return filtered;
  }, [search, statusFilter, priorityFilter, testCases]);

  const toggleRow = (id) => {
    setSelectedRows((prev) =>
      prev.includes(id)
        ? prev.filter((rowId) => rowId !== id)
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedRows.length === filteredTestCases.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredTestCases.map((tc) => tc.id));
    }
  };

  const applyBulkAction = () => {
    if (!bulkAction) return;

    selectedRows.forEach((id) => {
      onStatusChange(id, bulkAction);
    });

    setSelectedRows([]);
    setBulkAction("");
  };

  const statusChips = [
    ["all", "All"],
    ["passed", "Passed"],
    ["failed", "Failed"],
    ["blocked", "Blocked"],
    ["pending", "Not Executed"],
  ];

  const priorityChips = [
    ["all", "All"],
    ["high", "High"],
    ["medium", "Medium"],
    ["low", "Low"],
  ];

  return (
    <div className="base-card p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">Execution Tracker</h3>
          <p className="mt-1 text-xs text-muted">Monitor status progress and update test outcomes in bulk.</p>
        </div>

        <button
          onClick={() => {
            exportTestCasesCSV(
              filteredTestCases,
              "BugMind_Tracker"
            );
            showToast("Tracker exported successfully!");
          }}
          className="btn-secondary"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <MetricCard
          icon={<ClipboardList size={18} />}
          label="Total Tests"
          value={counts.total}
          tone="text-ink"
        />

        <MetricCard
          icon={<CheckCircle2 size={18} />}
          label="Passed"
          value={counts.passed}
          tone="text-verified"
        />

        <MetricCard
          icon={<XCircle size={18} />}
          label="Failed"
          value={counts.failed}
          tone="text-flagged"
        />

        <MetricCard
          icon={<Ban size={18} />}
          label="Blocked"
          value={counts.blocked}
          tone="text-orange-500"
        />

        <MetricCard
          icon={<Clock3 size={18} />}
          label="Not Executed"
          value={counts.pending}
          tone="text-ochre"
        />
      </div>

      <div className="mt-5 rounded-xl border border-hairline bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Execution Progress
          </h3>

          <span className="text-sm font-semibold text-signal">
            {progress}%
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-signal transition-all duration-500"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <p className="mt-3 text-sm text-muted">
          {executed} of {counts.total} test cases executed
        </p>
      </div>

      {hasTestCases && (
        <>
          <div className="mt-5 rounded-xl border border-hairline bg-paper p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, description, module or status..."
                  className="w-full rounded-lg border border-hairline bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-signal"
                />
              </div>

              <p className="text-xs text-muted">
                Showing <b>{filteredTestCases.length}</b> of <b>{counts.total}</b> test cases
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {statusChips.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === value
                      ? "border-signal bg-signal text-white"
                      : "border-hairline bg-white text-muted hover:border-signal hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Priority</span>
              {priorityChips.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setPriorityFilter(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    priorityFilter === value
                      ? "border-signal bg-signal text-white"
                      : "border-hairline bg-white text-muted hover:border-signal hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}

              {(statusFilter !== "all" || priorityFilter !== "all") && (
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setPriorityFilter("all");
                  }}
                  className="ml-1 text-xs font-semibold text-signal hover:underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

        </>
      )}

      {!hasTestCases ? (
        <div className="mt-5">
          <EmptyState
            title="Nothing to track yet"
            description="Execute some test cases to populate the tracker."
          />
        </div>
      ) : (
        <div className="mt-5">
          {selectedRows.length > 0 && (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-hairline bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-ink">
                {selectedRows.length} test case(s) selected
              </span>

              <div className="flex items-center gap-2">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm"
                >
                  <option value="">Bulk Action</option>
                  <option value="pass">Mark Passed</option>
                  <option value="fail">Mark Failed</option>
                  <option value="blocked">Mark Blocked</option>
                  <option value="pending">Mark Not Executed</option>
                </select>

                <button
                  onClick={applyBulkAction}
                  disabled={!bulkAction}
                  className="btn-primary"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {filteredTestCases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hairline bg-surface py-14 text-center">
              <Search
                size={38}
                className="mx-auto mb-4 text-muted"
              />

              <h3 className="text-lg font-semibold text-ink">
                No test cases found
              </h3>

              <p className="mt-2 text-sm text-muted">
                Try changing your search or clear the applied filters.
              </p>

              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
                className="btn-primary mt-5"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <TrackerTable
              testCases={filteredTestCases}
              onStatusChange={onStatusChange}
              onJumpToIssue={onJumpToIssue}
              selectedRows={selectedRows}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
            />
          )}
        </div>
      )}
    </div>
  );
}