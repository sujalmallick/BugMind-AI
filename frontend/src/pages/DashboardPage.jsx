import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bug,
  Building,
  ChevronRight,
  ClipboardList,
  Folder,
  History,
  Inbox,
  Layers,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { getMyDashboard } from "../services/dashboardApi";
import StatCard from "../components/dashboard/StatCard";
import DonutChart from "../components/dashboard/DonutChart";
import BarChart from "../components/dashboard/BarChart";
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
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
    test_case_status_breakdown,
    issue_severity_breakdown,
    recent_activity,
  } = data;

  const firstName = (user?.name || "").split(" ")[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .slice(0, 5);

  const workTabs = [
    { key: "testcases", label: "Test cases", count: assigned_test_cases.length },
    { key: "bugs", label: "Bugs", count: assigned_issues.length },
  ];

  return (
    <div className="projects-atmosphere flex min-h-screen flex-col">
      <HeaderBar connected={true} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        {/* Greeting */}
        <section className="section-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{today}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-[1.875rem]">
              {greeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1.5 text-[14px] text-muted">
              {summary.assigned_items > 0
                ? `You have ${summary.assigned_items} item${summary.assigned_items === 1 ? "" : "s"} assigned across your projects.`
                : "Nothing is assigned to you right now. Here's what's happening across your work."}
            </p>
          </div>
          <Link to="/" className="btn-secondary self-start sm:self-auto">
            All projects
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </section>

        {/* Stats */}
        <section className="section-enter section-enter-1 mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
          <StatCard
            title="Projects"
            value={summary.projects}
            icon={Folder}
            hint={`${summary.organizations} organization${summary.organizations === 1 ? "" : "s"}`}
          />
          <StatCard
            title="Teams"
            value={summary.teams ?? 0}
            icon={Building}
            colorClass="text-ochre"
            bgClass="bg-ochre-soft"
            hint="Teams you belong to"
          />
          <StatCard
            title="Assigned to you"
            value={summary.assigned_items}
            icon={Layers}
            colorClass="text-verified"
            bgClass="bg-verified-soft"
            hint={`${summary.assigned_test_cases ?? assigned_test_cases.length} cases · ${summary.assigned_issues ?? assigned_issues.length} bugs`}
          />
          <StatCard
            title="Unread"
            value={summary.unread_notifications}
            icon={Bell}
            colorClass="text-flagged"
            bgClass="bg-flagged-soft"
            hint="Notifications"
          />
        </section>

        {/* Work + activity */}
        <div className="section-enter section-enter-2 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel
            title="My work"
            className="lg:col-span-2"
            action={
              <SegmentedControl
                label="Assigned items"
                size="sm"
                value={activeWorkTab}
                onChange={setActiveWorkTab}
                options={workTabs.map((t) => ({ value: t.key, label: t.label, count: t.count }))}
              />
            }
          >
            <div key={activeWorkTab} className="animate-tab-enter max-h-[420px] overflow-y-auto scroll-thin -mx-2">
              {activeWorkTab === "testcases" &&
                (assigned_test_cases.length > 0 ? (
                  <ul className="divide-y divide-hairline">
                    {assigned_test_cases.map((tc) => (
                      <li key={tc.id}>
                        <Link
                          to={`/project/${tc.project.id}/workspace`}
                          className="group flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ink/[0.03]"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-signal">
                            <ClipboardList size={15} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink group-hover:text-signal">
                              <span className="font-mono text-[12px] text-muted">{tc.test_case_id}</span> {tc.description}
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-muted">
                              {tc.project.name}{tc.module ? ` · ${tc.module}` : ""}
                            </span>
                          </span>
                          <Pill tone={TC_STATUS_TONE[String(tc.status).toLowerCase()]} className="capitalize">{tc.status}</Pill>
                          <ChevronRight size={15} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    className="mx-2"
                    icon={<Inbox size={18} />}
                    title="No test cases assigned"
                    description="When someone assigns you a test case, it lands here."
                  />
                ))}

              {activeWorkTab === "bugs" &&
                (assigned_issues.length > 0 ? (
                  <ul className="divide-y divide-hairline">
                    {assigned_issues.map((bug) => (
                      <li key={bug.id}>
                        <Link
                          to={`/project/${bug.project.id}/workspace?issue=${bug.id}`}
                          className="group flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ink/[0.03]"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-flagged-soft text-flagged">
                            <Bug size={15} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink group-hover:text-signal">
                              <span className="font-mono text-[12px] text-muted">{bug.bug_id}</span> {bug.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-muted">
                              {bug.project.name} · Severity {bug.severity}
                            </span>
                          </span>
                          <Pill tone="flagged" className="capitalize">{bug.status}</Pill>
                          <ChevronRight size={15} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    className="mx-2"
                    icon={<Inbox size={18} />}
                    title="No bugs assigned"
                    description="Bugs assigned to you will show up here with their severity."
                  />
                ))}
            </div>
          </Panel>

          <Panel
            title="Recent activity"
            action={
              recent_activity.length > 4 && (
                <button
                  onClick={() => setShowAllActivity(!showAllActivity)}
                  className="text-[12px] font-medium text-muted transition-colors hover:text-ink"
                >
                  {showAllActivity ? "Show less" : `Show all ${recent_activity.length}`}
                </button>
              )
            }
          >
            {recent_activity.length > 0 ? (
              <div className="-mx-2 -my-1">
                {(showAllActivity ? recent_activity : recent_activity.slice(0, 4)).map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} hideAvatar={true} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<History size={18} />} title="No activity yet" description="Your recent edits and updates appear here." />
            )}
          </Panel>
        </div>

        {/* Charts */}
        <div className="section-enter section-enter-3 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Test case status">
            <div className="min-h-[256px]">
              <DonutChart data={test_case_status_breakdown} emptyMessage="No test cases assigned" />
            </div>
          </Panel>
          <Panel title="Open bugs by severity">
            <div className="min-h-[256px]">
              <BarChart data={issue_severity_breakdown} emptyMessage="No bugs assigned" />
            </div>
          </Panel>
        </div>

        {/* Projects + orgs */}
        <div className="section-enter section-enter-4 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel
            title="Recent projects"
            className="lg:col-span-2"
            action={
              <Link to="/" className="text-[12px] font-medium text-muted transition-colors hover:text-ink">
                View all
              </Link>
            }
          >
            {recentProjects.length > 0 ? (
              <ul className="-mx-2 -my-1">
                {recentProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/project/${p.id}/workspace`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ink/[0.03]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-paper text-muted group-hover:text-signal">
                        <Folder size={15} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{p.name}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {p.test_case_count ?? 0} test cases · {p.module_count ?? 0} modules
                          {p.updated_at ? ` · updated ${formatRelativeTime(p.updated_at)}` : ""}
                        </span>
                      </span>
                      <Pill>{p.status || "Draft"}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Folder size={18} />}
                title="No projects yet"
                description="Create a project to start turning workflows into test cases."
                action={<Link to="/" className="btn-primary">Go to projects</Link>}
              />
            )}
          </Panel>

          <Panel
            title="Organizations"
            action={
              <Link to="/organizations" className="text-[12px] font-medium text-muted transition-colors hover:text-ink">
                Manage
              </Link>
            }
          >
            {organizations.length > 0 ? (
              <ul className="-mx-2 -my-1">
                {organizations.slice(0, 5).map((o) => (
                  <li key={o.id}>
                    <Link
                      to={`/organizations/${o.id}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ink/[0.03]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-signal-soft text-[13px] font-semibold text-signal">
                        {o.logo_url ? <img src={o.logo_url} alt="" className="h-full w-full object-cover" /> : o.name?.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{o.name}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {o.member_count ?? 0} members · {o.team_count ?? 0} teams
                        </span>
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
      </main>
      <AppFooter />
    </div>
  );
}
