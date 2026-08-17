import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyDashboard } from "../services/dashboardApi";
import StatCard from "../components/dashboard/StatCard";
import DonutChart from "../components/dashboard/DonutChart";
import BarChart from "../components/dashboard/BarChart";
import ActivityItem from "../components/shared/ActivityItem";
import HeaderBar from "../components/layout/HeaderBar";
import AppFooter from "../components/layout/AppFooter";
import { Briefcase, Building, Layers, Bell, Folder, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [activeWorkTab, setActiveWorkTab] = useState("testcases");

  useEffect(() => {
    async function load() {
      try {
        const dashboardData = await getMyDashboard();
        setData(dashboardData);
      } catch (err) {
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <HeaderBar connected={true} />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-signal" />
        </div>
        <AppFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <HeaderBar connected={true} />
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-hairline bg-white p-10 text-center shadow-sm">
            <div className="rounded-full bg-flagged-soft p-3">
              <Bell className="h-6 w-6 text-flagged" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Unable to load dashboard</h2>
              <p className="mt-1 max-w-xs text-sm text-muted">Something went wrong while fetching your data. Check your connection and try again.</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-1"
            >
              Retry
            </button>
          </div>
        </div>
        <AppFooter />
      </div>
    );
  }

  const {
    summary,
    projects,
    organizations,
    assigned_test_cases,
    assigned_issues,
    test_case_status_breakdown,
    issue_severity_breakdown,
    recent_activity,
  } = data;

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <HeaderBar connected={true} />
      <main className="mx-auto max-w-7xl p-6 lg:p-8 flex-1 w-full">
        <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">My Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Overview of your work, teams, and recent activity.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <StatCard title="Total Projects" value={summary.projects} icon={Folder} colorClass="text-signal" />
        <StatCard title="Organizations" value={summary.organizations} icon={Building} colorClass="text-ochre" bgClass="bg-ochre-soft" />
        <StatCard title="Assigned Tasks" value={summary.assigned_items} icon={Layers} colorClass="text-verified" bgClass="bg-verified-soft" />
        <StatCard title="Notifications" value={summary.unread_notifications} icon={Bell} colorClass="text-flagged" bgClass="bg-flagged-soft" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
        {/* Test Case Status Breakdown */}
        <section className="signal-card p-6 flex flex-col">
          <h2 className="text-base font-semibold text-ink mb-4">Assigned Test Cases</h2>
          <div className="flex-1 min-h-[250px]">
            <DonutChart data={test_case_status_breakdown} emptyMessage="No test cases assigned" />
          </div>
        </section>

        {/* Issue Severity Breakdown */}
        <section className="signal-card p-6 flex flex-col">
          <h2 className="text-base font-semibold text-ink mb-4">Assigned Bugs</h2>
          <div className="flex-1 min-h-[250px]">
            <BarChart data={issue_severity_breakdown} emptyMessage="No bugs assigned" />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Unified Work Hub */}
        <section className="lg:col-span-2 signal-card p-6 flex flex-col min-h-[500px]">
          <div className="flex items-center gap-4 border-b border-hairline mb-6 pb-2">
            <button
              onClick={() => setActiveWorkTab("testcases")}
              className={`px-2 py-1.5 text-sm font-semibold transition-colors border-b-2 -mb-[9px] ${
                activeWorkTab === "testcases"
                  ? "border-signal text-signal"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              Assigned Test Cases ({assigned_test_cases.length})
            </button>
            <button
              onClick={() => setActiveWorkTab("bugs")}
              className={`px-2 py-1.5 text-sm font-semibold transition-colors border-b-2 -mb-[9px] ${
                activeWorkTab === "bugs"
                  ? "border-signal text-signal"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              Assigned Bugs ({assigned_issues.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {activeWorkTab === "testcases" && (
              assigned_test_cases.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {assigned_test_cases.map(tc => (
                    <li key={tc.id} className="py-3 flex justify-between items-center group">
                      <div>
                        <Link to={`/projects/${tc.project.id}/workspace`} className="text-sm font-medium text-ink group-hover:text-signal transition-colors">
                          {tc.test_case_id} — {tc.description}
                        </Link>
                        <p className="text-xs text-muted mt-0.5">{tc.project.name} • {tc.module}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-paper border border-hairline uppercase text-muted ml-4 whitespace-nowrap">
                        {tc.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted bg-surface rounded-xl border border-dashed border-hairline">
                  <p className="text-sm">No test cases assigned to you.</p>
                </div>
              )
            )}

            {activeWorkTab === "bugs" && (
              assigned_issues.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {assigned_issues.map(bug => (
                    <li key={bug.id} className="py-3 flex justify-between items-center group">
                      <div>
                        <Link to={`/projects/${bug.project.id}/workspace?issue=${bug.id}`} className="text-sm font-medium text-ink group-hover:text-signal transition-colors">
                          {bug.bug_id} — {bug.title}
                        </Link>
                        <p className="text-xs text-muted mt-0.5">{bug.project.name} • Severity: {bug.severity}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-flagged-soft text-flagged uppercase ml-4 whitespace-nowrap">
                        {bug.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted bg-surface rounded-xl border border-dashed border-hairline">
                  <p className="text-sm">No bugs assigned to you.</p>
                </div>
              )
            )}
          </div>
        </section>

        {/* Activity Feed Sidebar */}
        <section className="signal-card p-6">
          <h2 className="text-base font-semibold text-ink mb-4">Recent Activity</h2>
          {recent_activity.length > 0 ? (
            <div className="space-y-4">
              {(showAllActivity ? recent_activity : recent_activity.slice(0, 3)).map(activity => (
                <ActivityItem key={activity.id} activity={activity} hideAvatar={true} />
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
      </main>
      <AppFooter />
    </div>
  );
}