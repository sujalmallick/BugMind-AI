import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getTeamDashboard } from "../services/dashboardApi";
import AssigneeLoadBar from "../components/dashboard/AssigneeLoadBar";
import ActivityItem from "../components/shared/ActivityItem";
import HeaderBar from "../components/layout/HeaderBar";
import AppFooter from "../components/layout/AppFooter";
import { Users, Folder, LayoutGrid, ArrowLeft, Loader2 } from "lucide-react";
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
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="text-flagged mb-4">{error}</p>
          <Link to={`/organizations/${orgId}`} className="text-signal hover:underline">
            Back to Organization
          </Link>
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
    <div className="flex min-h-screen flex-col bg-surface">
      <HeaderBar connected={true} />
      <main className="mx-auto max-w-7xl p-6 lg:p-8 animate-fade-in flex-1 w-full">
        <div className="mb-8 flex items-center justify-between">
        <div>
          <Link to={`/organizations/${orgId}`} className="text-sm text-muted hover:text-ink flex items-center gap-1 mb-2 w-max">
            <ArrowLeft size={14} /> Back to Teams
          </Link>
          <h1 className="text-2xl font-bold text-ink">{team.name} Dashboard</h1>
          <p className="mt-1 text-sm text-muted">{organization.name} • {team.description || "No description provided."}</p>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <div className="signal-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-signal-soft text-signal">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Team Members</p>
            <p className="text-2xl font-semibold text-ink">{summary.members}</p>
          </div>
        </div>
        <div className="signal-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ochre-soft text-ochre">
            <Folder size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Active Projects</p>
            <p className="text-2xl font-semibold text-ink">{summary.projects}</p>
          </div>
        </div>
        <div className="signal-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-flagged-soft text-flagged">
            <LayoutGrid size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Open Items</p>
            <p className="text-2xl font-semibold text-ink">{summary.open_items}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Workload */}
        <section className="lg:col-span-2 signal-card p-6">
          <h2 className="text-base font-semibold text-ink mb-1">Workload Distribution</h2>
          <p className="text-sm text-muted mb-6">Current assignment load across team members.</p>
          
          {member_load.length > 0 ? (
            <div className="space-y-6">
              {member_load.map((member) => (
                <div key={member.user_id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-signal to-indigo-500 text-xs font-bold text-white uppercase">
                        {member.avatar_url ? (
                          <img src={getAvatarUrl(member.avatar_url)} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          (member.name || "?").charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink flex items-center gap-2">
                          {member.name}
                          {member.role === 'team_lead' && (
                            <span className="text-[10px] font-semibold text-ochre bg-ochre-soft px-1.5 py-0.5 rounded uppercase border border-ochre/20">Lead</span>
                          )}
                        </p>
                        <p className="text-xs text-muted">{member.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{member.total} <span className="text-muted font-normal">items</span></p>
                    </div>
                  </div>
                  
                  {/* Visual Load Bar */}
                  <AssigneeLoadBar 
                    testCasesCount={member.test_cases} 
                    issuesCount={member.issues} 
                    totalOpenItems={member.total} 
                  />
                  
                </div>
              ))}
              
              {/* Legend */}
              <div className="pt-4 mt-2 border-t border-hairline flex items-center gap-6 justify-end">
                <div className="flex items-center gap-2 text-xs font-medium text-muted">
                  <div className="w-3 h-3 rounded bg-signal"></div> Test Cases
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted">
                  <div className="w-3 h-3 rounded bg-flagged"></div> Bugs/Issues
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted py-8 text-center bg-paper rounded-xl border border-dashed border-hairline">
              No team members to display.
            </p>
          )}
        </section>

        {/* Activity Feed Sidebar */}
        <section className="signal-card p-6">
          <h2 className="text-base font-semibold text-ink mb-4">Team & Org Activity</h2>
          {recent_activity.length > 0 ? (
            <div className="space-y-4">
              {(showAllActivity ? recent_activity : recent_activity.slice(0, 3)).map(activity => (
                <ActivityItem key={activity.id} activity={activity} hideProject={false} />
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
            <p className="text-sm text-muted py-4 text-center">No recent activity.</p>
          )}
        </section>
      </div>
      </main>
      <AppFooter />
    </div>
  );
}