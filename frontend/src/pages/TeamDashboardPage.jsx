import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getTeamDashboard } from "../services/dashboardApi";
import AssigneeLoadBar from "../components/dashboard/AssigneeLoadBar";
import ActivityItem from "../components/shared/ActivityItem";
import Panel from "../components/shared/Panel";
import Pill from "../components/shared/Pill";
import EmptyState from "../components/shared/EmptyState";
import StatCard from "../components/dashboard/StatCard";
import HeaderBar from "../components/layout/HeaderBar";
import AppFooter from "../components/layout/AppFooter";
import { Users, Folder, LayoutGrid, Loader2, ChevronRight, Crown, History } from "lucide-react";
import { getAvatarUrl } from "../utils/avatarUrl";

export default function TeamDashboardPage() {
  const { orgId, teamId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllActivity, setShowAllActivity] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const dashboardData = await getTeamDashboard(orgId, teamId);
        setData(dashboardData);
      } catch (err) {
        setError("Failed to load team dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    if (orgId && teamId) {
      load();
    }
  }, [orgId, teamId]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <HeaderBar connected={true} />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 spin text-signal" aria-label="Loading team dashboard" />
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
            icon={<Users size={18} className="text-flagged" />}
            title="Unable to load this team"
            description={error}
            action={<Link to={`/organizations/${orgId}`} className="btn-secondary">Back to organization</Link>}
          />
        </div>
        <AppFooter />
      </div>
    );
  }

  const {
    organization,
    team,
    summary,
    member_load,
    recent_activity,
  } = data;

  return (
    <div className="projects-atmosphere flex min-h-screen flex-col">
      <HeaderBar connected={true} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-[13px] text-muted">
          <Link to="/organizations" className="rounded px-1 py-0.5 transition-colors hover:text-ink">Organizations</Link>
          <ChevronRight size={13} aria-hidden="true" className="text-muted/60" />
          <Link to={`/organizations/${orgId}`} className="rounded px-1 py-0.5 transition-colors hover:text-ink">{organization.name}</Link>
          <ChevronRight size={13} aria-hidden="true" className="text-muted/60" />
          <span className="px-1 font-medium text-ink" aria-current="page">{team.name}</span>
        </nav>

        <section className="section-enter">
          <p className="eyebrow">Team dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-[1.875rem]">{team.name}</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-muted">
            {team.description || `Workload and activity for this ${organization.name} team.`}
          </p>
        </section>

        <section className="section-enter section-enter-1 mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Summary">
          <StatCard title="Team members" value={summary.members} icon={Users} hint="People on this team" />
          <StatCard title="Active projects" value={summary.projects} icon={Folder} colorClass="text-ochre" bgClass="bg-ochre-soft" hint="Linked to this team" />
          <StatCard title="Open items" value={summary.open_items} icon={LayoutGrid} colorClass="text-flagged" bgClass="bg-flagged-soft" hint="Test cases and bugs in progress" />
        </section>

        <div className="section-enter section-enter-2 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel
            title="Workload distribution"
            description="Current assignment load across team members"
            className="lg:col-span-2"
            action={
              <div className="flex items-center gap-4 text-[12px] text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-signal" /> Test cases</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-flagged" /> Bugs</span>
              </div>
            }
          >
            {member_load.length > 0 ? (
              <ul className="space-y-5">
                {member_load.map((member) => (
                  <li key={member.user_id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-signal-soft text-[12px] font-semibold uppercase text-signal">
                          {member.avatar_url ? (
                            <img src={getAvatarUrl(member.avatar_url)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (member.name || "?").charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-[13px] font-medium text-ink">
                            {member.name}
                            {member.role === "team_lead" && <Pill tone="ochre" icon={Crown}>Lead</Pill>}
                          </p>
                          <p className="truncate text-[12px] text-muted">{member.email}</p>
                        </div>
                      </div>
                      <p className="shrink-0 text-[12px] text-muted">
                        <span className="text-[14px] font-semibold tabular-nums text-ink">{member.total}</span> items
                      </p>
                    </div>
                    <AssigneeLoadBar
                      testCasesCount={member.test_cases}
                      issuesCount={member.issues}
                      totalOpenItems={member.total}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Users size={18} />} title="No team members" description="Add members to this team from the organization page." />
            )}
          </Panel>

          <Panel
            title="Team & org activity"
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
                  <ActivityItem key={activity.id} activity={activity} hideProject={false} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<History size={18} />} title="No recent activity" description="Updates from this team's projects appear here." />
            )}
          </Panel>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
