import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building,
  Folder,
  History,
  Inbox,
  Loader2,
  PieChart as PieIcon,
  RefreshCw,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { getMyDashboard } from "../services/dashboardApi";
import DonutChart from "../components/dashboard/DonutChart";
import { STATUS_COLORS, SEVERITY_COLORS } from "../components/dashboard/chartColors";
import ActivityItem from "../components/shared/ActivityItem";
import EmptyState from "../components/shared/EmptyState";
import Panel from "../components/shared/Panel";
import Pill from "../components/shared/Pill";
import SegmentedControl from "../components/shared/SegmentedControl";
import HeaderBar from "../components/layout/HeaderBar";
import AppFooter from "../components/layout/AppFooter";
import { formatRelativeTime } from "../utils/time";

const TC_STATUS_TONE = {
  pass: "verified",
  passed: "verified",
  fail: "flagged",
  failed: "flagged",
  blocked: "ochre",
};

const SEVERITY_TONE = {
  critical: "flagged",
  high: "flagged",
  medium: "ochre",
  low: "neutral",
};

// One row of the KPI strip
function Metric({ label, value, detail, to }) {
  const body = (
    <>
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-[1.75rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">{value}</p>
      <p className="mt-2 truncate text-[12px] text-muted">{detail}</p>
    </>
  );
  return to ? (
    <Link to={to} className="group block bg-surface px-5 py-4 transition-colors hover:bg-paper">
      {body}
    </Link>
  ) : (
    <div className="bg-surface px-5 py-4">{body}</div>
  );
}

// Small table header cell
function Th({ children, className = "" }) {
  return <th scope="col" className={`whitespace-nowrap px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted ${className}`}>{children}</th>;
}

export default function DashboardPage() {
  const { user } = useAuth();
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
        <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading dashboard">
          <Loader2 className="h-6 w-6 spin text-signal" />
        </div>
        <AppFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <HeaderBar connected={true} />
        <div className="flex flex-1 items-center justify-center px-4 py-16">
          <EmptyState
            className="w-full max-w-md bg-surface"
            icon={<AlertTriangle size={18} className="text-flagged" />}
            title="Unable to load your dashboard"
            description="Something went wrong while fetching your data. Check your connection and try again."
            action={
              <button onClick={() => window.location.reload()} className="btn-primary">
                <RefreshCw size={14} aria-hidden="true" />
                Retry
              </button>
            }
          />
        </div>
        <AppFooter />
      </div>
    );
  }

  const {
    summary,
    projects = [],
    organizations = [],
    assigned_test_cases,
    assigned_issues,
    test_case_status_breakdown = [],
    issue_severity_breakdown = [],
    recent_activity,
  } = data;

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .slice(0, 6);
  const tcTotal = test_case_status_breakdown.reduce((s, d) => s + (d.count || 0), 0);
  const bugTotal = issue_severity_breakdown.reduce((s, d) => s + (d.count || 0), 0);
  const bugMax = Math.max(1, ...issue_severity_breakdown.map((d) => d.count || 0));
  const totalTestCases = projects.reduce((s, p) => s + (p.test_case_count || 0), 0);

  return (
    <div className="projects-atmosphere flex min-h-screen flex-col">
      <HeaderBar connected={true} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
        {/* Page header */}
        <section className="section-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]">Dashboard</h1>
            <p className="mt-1 text-[14px] text-muted">
              {user?.name ? `${user.name.split(" ")[0]}, here's` : "Here's"} your QA overview · {today}
            </p>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <Link to="/organizations" className="btn-secondary">
              <Building size={14} aria-hidden="true" />
              Organizations
            </Link>
            <Link to="/" className="btn-primary">
              Open projects
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* KPI strip */}
        <section
          aria-label="Summary"
          className="section-enter section-enter-1 mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline shadow-[var(--shadow-card)] lg:grid-cols-4"
        >
          <Metric label="Projects" value={summary.projects} detail={`${totalTestCases} test cases across all projects`} to="/" />
          <Metric
            label="Assigned to you"
            value={summary.assigned_items}
            detail={`${assigned_test_cases.length} test cases · ${assigned_issues.length} bugs`}
          />
          <Metric
            label="Organizations"
            value={summary.organizations}
            detail={`${summary.teams ?? 0} team${summary.teams === 1 ? "" : "s"} you belong to`}
            to="/organizations"
          />
          <Metric
            label="Unread notifications"
            value={summary.unread_notifications}
            detail={summary.unread_notifications > 0 ? "Open the bell to review" : "You're all caught up"}
          />
        </section>

        {/* Work + activity */}
        <div className="section-enter section-enter-2 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel
            title="My work"
            description="Items assigned to you across projects"
            className="lg:col-span-2"
            bodyClassName=""
            action={
              <SegmentedControl
                label="Assigned items"
                size="sm"
                value={activeWorkTab}
                onChange={setActiveWorkTab}
                options={[
                  { value: "testcases", label: "Test cases", count: assigned_test_cases.length },
                  { value: "bugs", label: "Bugs", count: assigned_issues.length },
                ]}
              />
            }
          >
            <div key={activeWorkTab} className="animate-tab-enter scroll-thin max-h-[420px] overflow-auto">
              {activeWorkTab === "testcases" &&
                (assigned_test_cases.length > 0 ? (
                  <table className="w-full min-w-[520px] text-[13px]">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-hairline">
                        <Th className="w-28">ID</Th>
                        <Th>Test case</Th>
                        <Th className="hidden md:table-cell">Project</Th>
                        <Th className="w-28 text-right">Status</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {assigned_test_cases.map((tc) => (
                        <tr key={tc.id} className="group transition-colors hover:bg-ink/[0.02]">
                          <td className="px-5 py-3 font-mono text-[12px] text-muted">{tc.test_case_id}</td>
                          <td className="max-w-0 px-5 py-3">
                            <Link to={`/project/${tc.project.id}/workspace`} className="block truncate font-medium text-ink group-hover:text-signal">
                              {tc.description}
                            </Link>
                            {tc.module && <span className="block truncate text-[12px] text-muted">{tc.module}</span>}
                          </td>
                          <td className="hidden max-w-[180px] truncate px-5 py-3 text-muted md:table-cell">{tc.project.name}</td>
                          <td className="px-5 py-3 text-right">
                            <Pill tone={TC_STATUS_TONE[String(tc.status).toLowerCase()]} className="capitalize">{tc.status}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-5">
                    <EmptyState icon={<Inbox size={18} />} title="No test cases assigned" description="When someone assigns you a test case, it lands here." />
                  </div>
                ))}

              {activeWorkTab === "bugs" &&
                (assigned_issues.length > 0 ? (
                  <table className="w-full min-w-[520px] text-[13px]">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-hairline">
                        <Th className="w-28">ID</Th>
                        <Th>Bug</Th>
                        <Th className="hidden md:table-cell">Severity</Th>
                        <Th className="w-28 text-right">Status</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {assigned_issues.map((bug) => (
                        <tr key={bug.id} className="group transition-colors hover:bg-ink/[0.02]">
                          <td className="px-5 py-3 font-mono text-[12px] text-muted">{bug.bug_id}</td>
                          <td className="max-w-0 px-5 py-3">
                            <Link to={`/project/${bug.project.id}/workspace?issue=${bug.id}`} className="block truncate font-medium text-ink group-hover:text-signal">
                              {bug.title}
                            </Link>
                            <span className="block truncate text-[12px] text-muted">{bug.project.name}</span>
                          </td>
                          <td className="hidden px-5 py-3 md:table-cell">
                            <Pill tone={SEVERITY_TONE[String(bug.severity).toLowerCase()] || "neutral"} className="capitalize">{bug.severity}</Pill>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Pill className="capitalize">{bug.status}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-5">
                    <EmptyState icon={<Inbox size={18} />} title="No bugs assigned" description="Bugs assigned to you show up here with their severity." />
                  </div>
                ))}
            </div>
          </Panel>

          <Panel
            title="Activity"
            description="Your latest changes"
            action={
              recent_activity.length > 5 && (
                <button
                  onClick={() => setShowAllActivity(!showAllActivity)}
                  className="text-[12px] font-medium text-muted transition-colors hover:text-ink"
                >
                  {showAllActivity ? "Show less" : `View all ${recent_activity.length}`}
                </button>
              )
            }
          >
            {recent_activity.length > 0 ? (
              <ol className="relative -mx-2 -my-1 before:absolute before:bottom-4 before:left-[23px] before:top-4 before:w-px before:bg-hairline">
                {(showAllActivity ? recent_activity : recent_activity.slice(0, 5)).map((activity) => (
                  <li key={activity.id} className="relative">
                    <ActivityItem activity={activity} hideAvatar={true} />
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={<History size={18} />} title="No activity yet" description="Your recent edits and updates appear here." />
            )}
          </Panel>
        </div>

        {/* Quality overview */}
        <div className="section-enter section-enter-3 mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Panel title="Test case status" description={`${tcTotal} assigned to you`}>
            {tcTotal > 0 ? (
              <div className="flex items-center gap-5">
                <div className="w-40 shrink-0">
                  <DonutChart data={test_case_status_breakdown} compact centerLabel="cases" />
                </div>
                <ul className="min-w-0 flex-1 space-y-2.5">
                  {test_case_status_breakdown.map((d) => (
                    <li key={d.key} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2 text-muted">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[d.key] || "#2563eb" }} />
                        <span className="truncate capitalize">{d.label}</span>
                      </span>
                      <span className="font-medium tabular-nums text-ink">{d.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState icon={<PieIcon size={18} />} title="No test cases assigned" description="Status breakdown appears once cases are assigned to you." />
            )}
          </Panel>

          <Panel title="Open bugs by severity" description={`${bugTotal} open`}>
            {bugTotal > 0 ? (
              <ul className="space-y-3.5">
                {issue_severity_breakdown.map((d) => (
                  <li key={d.key}>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="capitalize text-muted">{d.label}</span>
                      <span className="font-medium tabular-nums text-ink">{d.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-hairline">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${(d.count / bugMax) * 100}%`, background: SEVERITY_COLORS[d.key] || "#2563eb" }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<BarChart3 size={18} />} title="No open bugs" description="Bugs assigned to you are grouped here by severity." />
            )}
          </Panel>

          <Panel
            title="Organizations"
            description={`${organizations.length} you belong to`}
            className="md:col-span-2 lg:col-span-1"
            action={
              <Link to="/organizations" className="text-[12px] font-medium text-muted transition-colors hover:text-ink">
                Manage
              </Link>
            }
          >
            {organizations.length > 0 ? (
              <ul className="-mx-2 -my-1">
                {organizations.slice(0, 4).map((o) => (
                  <li key={o.id}>
                    <Link
                      to={`/organizations/${o.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-ink/[0.03]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-signal-soft text-[13px] font-semibold text-signal">
                        {o.logo_url ? <img src={o.logo_url} alt="" className="h-full w-full object-cover" /> : o.name?.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{o.name}</span>
                        <span className="block truncate text-[12px] text-muted">{o.member_count ?? 0} members · {o.team_count ?? 0} teams</span>
                      </span>
                      {o.my_role && <Pill className="capitalize">{o.my_role}</Pill>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Building size={18} />}
                title="No organizations"
                description="Create one to share projects with your team."
                action={<Link to="/organizations" className="btn-secondary">Create organization</Link>}
              />
            )}
          </Panel>
        </div>

        {/* Recent projects */}
        <Panel
          title="Recent projects"
          description="Most recently updated"
          className="section-enter section-enter-4 mt-6"
          bodyClassName=""
          action={
            <Link to="/" className="text-[12px] font-medium text-muted transition-colors hover:text-ink">
              View all
            </Link>
          }
        >
          {recentProjects.length > 0 ? (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="border-b border-hairline">
                    <Th>Project</Th>
                    <Th className="w-28">Status</Th>
                    <Th className="w-28 text-right">Test cases</Th>
                    <Th className="w-24 text-right">Modules</Th>
                    <Th className="w-32 text-right">Updated</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {recentProjects.map((p) => (
                    <tr key={p.id} className="group transition-colors hover:bg-ink/[0.02]">
                      <td className="max-w-0 px-5 py-3">
                        <Link to={`/project/${p.id}/workspace`} className="flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-paper text-muted group-hover:text-signal">
                            <Folder size={14} aria-hidden="true" />
                          </span>
                          <span className="truncate font-medium text-ink group-hover:text-signal">{p.name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3"><Pill>{p.status || "Draft"}</Pill></td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">{p.test_case_count ?? 0}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink">{p.module_count ?? 0}</td>
                      <td className="px-5 py-3 text-right text-muted">{p.updated_at ? formatRelativeTime(p.updated_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={<Folder size={18} />}
                title="No projects yet"
                description="Create a project to start turning workflows into test cases."
                action={<Link to="/" className="btn-primary">Go to projects</Link>}
              />
            </div>
          )}
        </Panel>
      </main>
      <AppFooter />
    </div>
  );
}
