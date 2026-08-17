import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProjectDashboard } from "../services/dashboardApi";
import StatCard from "../components/dashboard/StatCard";
import DonutChart from "../components/dashboard/DonutChart";
import BarChart from "../components/dashboard/BarChart";
import ActivityItem from "../components/shared/ActivityItem";
import WorkloadSuggestionPanel from "../components/ai/WorkloadSuggestionPanel";
import { suggestAssignments } from "../services/aiWorkloadApi";
import { Folder, AlertCircle, FileText, Loader2, User, Sparkles, X } from "lucide-react";
import { getAvatarUrl } from "../utils/avatarUrl";

export default function ProjectDashboardPage() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [errorModal, setErrorModal] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const dashboardData = await getProjectDashboard(projectId);
        setData(dashboardData);
      } catch (err) {
        setError("Failed to load project dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    if (projectId) {
      load();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-signal" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-flagged">{error}</p>
      </div>
    );
  }

  const {
    total_test_cases,
    total_issues,
    open_issues,
    test_case_status_breakdown,
    issue_severity_breakdown,
    top_assignees,
    recent_activity,
  } = data;

  const handleAutoAssign = async () => {
    setAiLoading(true);
    try {
      const result = await suggestAssignments(projectId);
      setSuggestion(result);
      setShowPanel(true);
    } catch (err) {
      const msg = err?.response?.data?.detail || "AI suggestion failed. Make sure you have an AI provider configured.";
      setErrorModal(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handlePanelClose = () => {
    setShowPanel(false);
    setSuggestion(null);
  };

  const handleApplied = async () => {
    setShowPanel(false);
    setSuggestion(null);
    // Reload dashboard to reflect new assignments
    const updated = await getProjectDashboard(projectId);
    setData(updated);
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* Error Modal */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-hairline w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-flagged-soft flex items-center justify-center">
                <AlertCircle size={20} className="text-flagged" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-ink mb-1">Auto-Assign Failed</h3>
                <p className="text-sm text-muted leading-relaxed">{errorModal}</p>
              </div>
              <button onClick={() => setErrorModal(null)} className="text-muted hover:text-ink transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setErrorModal(null)}
                className="px-5 py-2 bg-signal text-white text-sm font-semibold rounded-lg hover:bg-signal-hover transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header row with AI button — only for org projects */}
      {data?.organization_id && (
        <div className="flex items-center justify-between">
          <div />
          <button
            onClick={handleAutoAssign}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm disabled:opacity-60"
          >
            {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {aiLoading ? "Analyzing..." : "AI Auto-Assign"}
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Test Cases" value={total_test_cases} icon={FileText} colorClass="text-signal" bgClass="bg-signal-soft" />
        <StatCard title="Total Bugs" value={total_issues} icon={AlertCircle} colorClass="text-ochre" bgClass="bg-ochre-soft" />
        <StatCard title="Open Bugs" value={open_issues} icon={AlertCircle} colorClass="text-flagged" bgClass="bg-flagged-soft" />
        <StatCard title="Team Members" value={top_assignees.length} icon={User} colorClass="text-muted" bgClass="bg-paper" />
      </div>

      {/* AI Suggestion Slide-in Panel */}
      {showPanel && suggestion && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={handlePanelClose} />
          <WorkloadSuggestionPanel
            projectId={projectId}
            suggestion={suggestion}
            onClose={handlePanelClose}
            onApplied={handleApplied}
          />
        </>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Test Case Status Breakdown */}
        <section className="signal-card p-6 flex flex-col">
          <h2 className="text-base font-semibold text-ink mb-4">Test Case Status</h2>
          <div className="flex-1 min-h-[250px]">
            <DonutChart data={test_case_status_breakdown} emptyMessage="No test cases yet" />
          </div>
        </section>

        {/* Issue Severity Breakdown */}
        <section className="signal-card p-6 flex flex-col">
          <h2 className="text-base font-semibold text-ink mb-4">Open Bugs by Severity</h2>
          <div className="flex-1 min-h-[250px]">
            <BarChart data={issue_severity_breakdown} emptyMessage="No open bugs" />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Top Assignees */}
        <section className="lg:col-span-2 signal-card p-6">
          <h2 className="text-base font-semibold text-ink mb-4">Top Assignees (Open Load)</h2>
          {top_assignees.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
              <table className="min-w-full divide-y divide-hairline">
                <thead className="bg-paper">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Assignee</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">Test Cases</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">Bugs</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline bg-white">
                  {top_assignees.map((user) => (
                    <tr key={user.user_id}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-signal to-indigo-500 text-[10px] font-bold text-white uppercase">
                            {user.avatar_url ? (
                              <img src={getAvatarUrl(user.avatar_url)} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              (user.name || "?").charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-ink">{user.name}</p>
                            <p className="text-xs text-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-ink">{user.test_cases}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-flagged">{user.issues}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-ink">{user.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted py-4 text-center">No assignments yet.</p>
          )}
        </section>

        {/* Recent Activity */}
        <section className="signal-card p-6">
          <h2 className="text-base font-semibold text-ink mb-4">Project Activity</h2>
          {recent_activity.length > 0 ? (
            <div className="space-y-4">
              {(showAllActivity ? recent_activity : recent_activity.slice(0, 3)).map(activity => (
                <ActivityItem key={activity.id} activity={activity} hideProject={true} />
              ))}
              {recent_activity.length > 3 && (
                <button
                  onClick={() => setShowAllActivity(!showAllActivity)}
                  className="w-full text-center text-sm font-medium text-signal hover:underline mt-2 pt-2 border-t border-hairline"
                >
                  {showAllActivity ? "Show less" : `Show all (${recent_activity.length})`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted py-4 text-center">No activity to show.</p>
          )}
        </section>
      </div>
    </div>
  );
}