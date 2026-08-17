import { useState, useEffect } from "react";
import {
  Building2, Plus, Loader2, ArrowLeft, Users, Settings,
  Crown, ShieldCheck, User, Trash2, FolderKanban, ListChecks, Sparkles, Layers3
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useOrgStore from "../store/useOrgStore";
import OrgCard from "../components/organization/OrgCard";
import OrgCreateModal from "../components/organization/OrgCreateModal";
import OrgMemberList from "../components/organization/OrgMemberList";
import TeamCard from "../components/organization/TeamCard";
import TeamCreateModal from "../components/organization/TeamCreateModal";
import TeamMemberList from "../components/organization/TeamMemberList";
import OrgSettingsPanel from "../components/organization/OrgSettingsPanel";
import OrgInvitePanel from "../components/organization/OrgInvitePanel";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import AppFooter from "../components/layout/AppFooter";
import { createProject as createProjectApi, getProjects, addTeamToProject } from "../services/projectApi";
import { getTeamDashboard } from "../services/dashboardApi";
import logo from "../assets/bugmind2.png";
import favicon from "../assets/favicon.png";

const ROLE_META = {
  owner:  { label: "Owner",  color: "bg-ochre-soft text-ochre border-ochre/30",   icon: Crown },
  admin:  { label: "Admin",  color: "bg-signal-soft text-signal border-signal/30", icon: ShieldCheck },
  member: { label: "Member", color: "bg-paper text-muted border-hairline",          icon: User },
};

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const { orgId } = useParams();
  const { user } = useAuth();
  const store = useOrgStore();

  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [activeTab, setActiveTab] = useState("teams");
  const [activeTeam, setActiveTeam] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState("import");
  const [projects, setProjects] = useState([]);
  const [teamDashboard, setTeamDashboard] = useState(null);
  const [showDeleteTeamDialog, setShowDeleteTeamDialog] = useState(false);

  const [assignProjectId, setAssignProjectId] = useState("");
  const [assigningProject, setAssigningProject] = useState(false);

  // When orgId changes or component mounts, fetch appropriate data
  useEffect(() => {
    if (orgId) {
      store.loadOrg(parseInt(orgId, 10));
    } else {
      store.loadOrgs();
      store.reset(); // clear active org state
    }
  }, [orgId]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects();
        setProjects(data);
      } catch (error) {
        console.error(error);
      }
    }

    loadProjects();
  }, []);

  // Load team members when viewing a team
  useEffect(() => {
    if (activeTeam && store.activeOrg) {
      store.loadTeamMembers(store.activeOrg.id, activeTeam.id);
    }
  }, [activeTeam, store.activeOrg]);

  useEffect(() => {
    let mounted = true;

    async function loadTeamDashboard() {
      if (!orgId || !activeTeam) {
        setTeamDashboard(null);
        return;
      }

      try {
        const data = await getTeamDashboard(orgId, activeTeam.id);
        if (mounted) {
          setTeamDashboard(data);
        }
      } catch (error) {
        if (mounted) {
          setTeamDashboard(null);
        }
      }
    }

    loadTeamDashboard();

    return () => {
      mounted = false;
    };
  }, [activeTeam, orgId]);

  const org = store.activeOrg;
  const myRole = org?.my_role || "member";
  const isOwner = myRole === "owner";
  const canManageTeams = myRole === "owner" || myRole === "admin";

  // Enforce tab access control
  useEffect(() => {
    if (org && activeTab === "settings" && !isOwner) {
      setActiveTab("teams");
    }
  }, [org, activeTab, isOwner]);

  const RoleIcon = ROLE_META[myRole]?.icon || User;
  const roleColor = ROLE_META[myRole]?.color || ROLE_META.member.color;
  const roleLabel = ROLE_META[myRole]?.label || ROLE_META.member.label;
  const orgProjects = projects.filter((project) => project.organizationId === org?.id);
  const teamProjects = activeTeam ? orgProjects.filter(p => p.assigned_team_ids?.includes(activeTeam.id)) : [];
  const teamAssignments = teamDashboard?.member_load || [];

  // ── Header ────────────────────────────────────────────────────────────────
  const TopHeader = () => (
    <header className="sticky top-0 z-50 border-b border-hairline bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-8">
        <div
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
          onClick={() => navigate("/")}
        >
          <img src={favicon} alt="BugMind" className="h-9 w-9 object-contain" />
          <img src={logo} alt="BugMind AI" className="h-10 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          {activeTeam ? (
            <button
              onClick={() => setActiveTeam(null)}
              className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-medium text-muted
                         transition hover:bg-paper hover:text-ink flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> Back to {org?.name || "Organization"}
            </button>
          ) : orgId ? (
            <button
              onClick={() => navigate("/organizations")}
              className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-medium text-muted
                         transition hover:bg-paper hover:text-ink flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> Back to Organizations
            </button>
          ) : (
            <button
              onClick={() => navigate("/")}
              className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-medium text-muted
                         transition hover:bg-paper hover:text-ink flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> Back to Projects
            </button>
          )}
        </div>
      </div>
    </header>
  );

  if (store.loading && !org && !store.orgs.length) {
    return (
      <div className="workspace-atmosphere min-h-screen">
        <TopHeader />
        <main className="mx-auto flex w-full max-w-5xl items-center justify-center py-20 px-4 sm:px-8">
          <Loader2 size={28} className="animate-spin text-signal" />
        </main>
      </div>
    );
  }

  return (
    <div className="workspace-atmosphere min-h-screen flex flex-col">
      <TopHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 flex-1">
        {/* ── LIST VIEW ───────────────────────────────────────────────────── */}
        {!orgId ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-ink">Organizations</h1>
                <p className="text-sm text-muted mt-0.5">
                  Manage your teams and collaborative workspaces.
                </p>
              </div>
              {store.orgs.length > 0 && (
                <button
                  onClick={() => setShowCreateOrg(true)}
                  className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold
                             text-white shadow-sm transition hover:bg-signal/90 hover:-translate-y-0.5"
                >
                  <Plus size={15} /> New organization
                </button>
              )}
            </div>

            {store.orgs.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-hairline py-20 px-8 text-center bg-surface">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-signal-soft text-signal">
                  <Building2 size={26} />
                </div>
                <div>
                  <p className="text-base font-semibold text-ink">No organizations yet</p>
                  <p className="mt-1 max-w-sm text-sm text-muted leading-relaxed">
                    Create your first organization to start collaborating with your QA team and sharing test cases.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateOrg(true)}
                  className="flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold
                             text-white shadow-sm transition hover:bg-signal/90 hover:-translate-y-0.5 mt-2"
                >
                  <Plus size={14} /> Create organization
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {store.orgs.map((o) => (
                  <OrgCard key={o.id} org={o} onClick={() => navigate(`/organizations/${o.id}`)} />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── DETAIL VIEW ────────────────────────────────────────────────── */
          org && (
            <div className="animate-fade-in">
              {/* Breadcrumbs for deep views (like team detail) */}
              {activeTeam && (
                <div className="flex items-center gap-1.5 text-xs text-muted mb-4">
                  <button onClick={() => navigate("/organizations")} className="hover:text-signal transition">
                    Organizations
                  </button>
                  <span className="text-muted/50">/</span>
                  <button onClick={() => setActiveTeam(null)} className="hover:text-signal transition text-ink font-medium">
                    {org.name}
                  </button>
                  <span className="text-muted/50">/</span>
                  <span className="text-ink font-medium">{activeTeam.name}</span>
                </div>
              )}

              {/* Org Header */}
              {!activeTeam && (
                <div className="mb-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl
                                      bg-linear-to-br from-signal to-indigo-500 text-white shadow-sm text-xl font-bold">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt={org.name} className="h-full w-full rounded-xl object-cover" />
                        ) : (
                          org.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <h1 className="text-2xl font-bold text-ink truncate font-sans">{org.name}</h1>
                          <span className={`shrink-0 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${roleColor}`}>
                            <RoleIcon size={12} />
                            {roleLabel}
                          </span>
                        </div>
                        <p className="text-sm text-muted font-mono mt-1">{org.slug}</p>
                      </div>
                    </div>
                  </div>
                  {org.description && (
                    <p className="mt-4 text-sm text-muted max-w-2xl leading-relaxed">{org.description}</p>
                  )}
                </div>
              )}

              {/* Team Detail View */}
              {activeTeam ? (
                <div className="animate-fade-in">
                  <section className="mb-6 rounded-3xl border border-hairline bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <p className="inline-flex items-center gap-2 rounded-full border border-signal/20 bg-signal-soft px-3 py-1 text-xs font-semibold text-signal">
                          <Sparkles size={13} />
                          Team overview
                        </p>
                        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">{activeTeam.name}</h1>
                        <p className="mt-2 text-sm text-muted">
                          {activeTeam.description || "Team members, project coverage, and assignments in one place."}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                          <span className="rounded-full border border-hairline bg-paper px-2.5 py-1 font-semibold">Members: {store.teamMembers[activeTeam.id]?.length ?? 0}</span>
                          <span className="rounded-full border border-hairline bg-paper px-2.5 py-1 font-semibold">Projects: {teamProjects.length}</span>
                          <span className="rounded-full border border-hairline bg-paper px-2.5 py-1 font-semibold">Assignments: {teamAssignments.reduce((sum, member) => sum + member.total, 0)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {canManageTeams && (
                          <button
                            type="button"
                            onClick={() => setShowDeleteTeamDialog(true)}
                            className="flex items-center gap-1.5 rounded-lg border border-flagged/40 bg-flagged-soft px-4 py-2 text-sm font-semibold text-flagged transition hover:bg-flagged hover:text-white"
                          >
                            <Trash2 size={14} /> Delete team
                          </button>
                        )}
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-3xl border border-hairline bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-ink">Members</h2>
                          <p className="text-sm text-muted">People on this team.</p>
                        </div>
                        {canManageTeams && (() => {
                          const eligibleMembers = store.members.filter(m => !(store.teamMembers[activeTeam.id] || []).some(tm => tm.user_id === m.user_id));
                          return (
                            <select
                              className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-medium text-ink transition focus:border-signal focus:outline-none disabled:opacity-50 disabled:bg-paper"
                              disabled={eligibleMembers.length === 0}
                              value=""
                              onChange={async (e) => {
                                if (!e.target.value) return;
                                const uid = parseInt(e.target.value, 10);
                                try {
                                  await store.addTeamMember(org.id, activeTeam.id, { user_id: uid, role: "member" });
                                } catch (err) {
                                  alert(err.message || "Failed to add member");
                                }
                              }}
                            >
                              <option value="" disabled>
                                {eligibleMembers.length === 0 ? "No other members available" : "+ Add member"}
                              </option>
                              {eligibleMembers.map(m => (
                                <option key={m.user_id} value={m.user_id}>{m.user?.name || m.user?.email}</option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                      <TeamMemberList
                        members={store.teamMembers[activeTeam.id] ?? []}
                        currentUserId={user?.id}
                        canManage={canManageTeams}
                        onRemove={(uid) => store.removeTeamMember(org.id, activeTeam.id, uid)}
                      />
                    </section>

                    <section className="rounded-3xl border border-hairline bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <h2 className="text-lg font-semibold text-ink">Projects</h2>
                          <p className="text-sm text-muted">Projects linked to this team.</p>
                        </div>
                        {canManageTeams && (() => {
                          const assignableProjects = orgProjects.filter(p => !p.assigned_team_ids?.includes(activeTeam.id));
                          if (assignableProjects.length === 0) return null;
                          return (
                            <div className="flex items-center gap-2">
                              <select
                                value={assignProjectId}
                                onChange={(e) => setAssignProjectId(e.target.value)}
                                className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-medium text-ink transition focus:border-signal focus:outline-none"
                              >
                                <option value="">Assign org project…</option>
                                {assignableProjects.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!assignProjectId || assigningProject}
                                onClick={async () => {
                                  if (!assignProjectId) return;
                                  setAssigningProject(true);
                                  try {
                                    await addTeamToProject(parseInt(assignProjectId, 10), activeTeam.id);
                                    const refreshedProjects = await getProjects();
                                    setProjects(refreshedProjects);
                                    setAssignProjectId("");
                                  } catch (error) {
                                    alert(error?.response?.data?.detail || error.message || "Failed to assign project");
                                  } finally {
                                    setAssigningProject(false);
                                  }
                                }}
                                className="flex items-center justify-center rounded-lg bg-signal px-3 py-2 text-xs font-semibold text-white transition hover:bg-signal/90 disabled:opacity-50"
                              >
                                {assigningProject ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Assign
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="space-y-3">
                        {orgProjects.filter(p => p.assigned_team_ids?.includes(activeTeam.id)).length > 0 ? (
                          orgProjects.filter(p => p.assigned_team_ids?.includes(activeTeam.id)).map((project) => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => navigate(`/project/${project.id}/workspace`)}
                              className="w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-left transition hover:border-signal hover:bg-paper"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-ink">{project.name}</p>
                                  <p className="text-xs text-muted">{project.description || "No description"}</p>
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-muted">
                                Open workspace to review test cases and assign them to team members.
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-hairline bg-surface px-4 py-8 text-center text-sm text-muted">
                            No projects have been imported into this team yet.
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-hairline bg-white p-6 shadow-sm xl:col-span-2">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-ink">Assignments</h2>
                          <p className="text-sm text-muted">Current load across the team.</p>
                        </div>
                        <button
                          onClick={() => navigate(`/organizations/${org.id}/teams/${activeTeam.id}/dashboard`)}
                          className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal"
                        >
                          Open dashboard
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {teamAssignments.length > 0 ? teamAssignments.map((member) => (
                          <div key={member.user_id} className="rounded-2xl border border-hairline bg-surface px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-ink">{member.name}</p>
                                <p className="text-xs text-muted">{member.role}</p>
                              </div>
                              <span className="rounded-full border border-hairline bg-white px-2.5 py-1 text-xs font-semibold text-muted">
                                {member.total} items
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
                              <div className="rounded-lg bg-white px-3 py-2 text-center">
                                <p className="font-semibold text-ink">{member.test_cases}</p>
                                <p>Cases</p>
                              </div>
                              <div className="rounded-lg bg-white px-3 py-2 text-center">
                                <p className="font-semibold text-ink">{member.issues}</p>
                                <p>Issues</p>
                              </div>
                              <div className="rounded-lg bg-white px-3 py-2 text-center">
                                <p className="font-semibold text-ink">{member.total}</p>
                                <p>Total</p>
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-hairline bg-surface px-4 py-8 text-center text-sm text-muted xl:col-span-3">
                            No assignment data yet.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              ) : (
                /* Org Tabs View */
                <div>
                  <div className="mb-6 flex border-b border-hairline">
                    <button
                      onClick={() => setActiveTab("teams")}
                      className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors
                        ${activeTab === "teams" ? "border-signal text-signal" : "border-transparent text-muted hover:text-ink hover:border-hairline"}`}
                    >
                      Teams
                    </button>
                    <button
                      onClick={() => setActiveTab("members")}
                      className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors
                        ${activeTab === "members" ? "border-signal text-signal" : "border-transparent text-muted hover:text-ink hover:border-hairline"}`}
                    >
                      Members
                    </button>
                    {canManageTeams && (
                      <button
                        onClick={() => setActiveTab("invite")}
                        className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors
                          ${activeTab === "invite" ? "border-signal text-signal" : "border-transparent text-muted hover:text-ink hover:border-hairline"}`}
                      >
                        Invite
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => setActiveTab("settings")}
                        className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors
                          ${activeTab === "settings" ? "border-signal text-signal" : "border-transparent text-muted hover:text-ink hover:border-hairline"}`}
                      >
                        Settings
                      </button>
                    )}
                  </div>

                  {activeTab === "teams" && (
                    <section className="animate-fade-in">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                          Teams
                          <span className="rounded-full bg-paper border border-hairline px-2 py-0.5 text-xs font-mono text-muted">
                            {store.teams.length}
                          </span>
                        </h2>
                        {canManageTeams && (
                          <button
                            onClick={() => setShowCreateTeam(true)}
                            className="flex items-center gap-1.5 rounded-lg bg-surface border border-hairline px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-paper hover:-translate-y-0.5"
                          >
                            <Plus size={14} /> Create team
                          </button>
                        )}
                      </div>

                        {store.teams.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline py-12 text-center bg-surface">
                          <Users size={24} className="text-muted/60" />
                          <div>
                            <p className="text-sm font-semibold text-ink">No teams yet</p>
                            <p className="text-xs text-muted max-w-xs mt-1">Organize your members into groups based on projects or roles.</p>
                          </div>
                          {canManageTeams && (
                            <button
                              onClick={() => setShowCreateTeam(true)}
                              className="mt-2 text-sm font-medium text-signal hover:underline flex items-center gap-1"
                            >
                              <Plus size={14} /> Create the first team
                            </button>
                          )}
                        </div>
                        ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {store.teams.map((team) => (
                            <TeamCard key={team.id} team={team} onClick={() => setActiveTeam(team)} />
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === "members" && (
                    <section className="signal-card p-6 max-w-3xl animate-fade-in">
                      <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                          Organization Members
                          <span className="rounded-full bg-paper border border-hairline px-2 py-0.5 text-xs font-mono text-muted">
                            {store.members.length}
                          </span>
                        </h2>
                      </div>
                      <OrgMemberList
                        members={store.members}
                        currentUserId={user?.id}
                        myRole={myRole}
                        onRoleChange={(uid, role) => store.changeMemberRole(org.id, uid, role)}
                        onRemove={(uid) => store.removeMember(org.id, uid)}
                      />
                    </section>
                  )}

                  {activeTab === "settings" && isOwner && (
                    <div className="animate-fade-in">
                      <OrgSettingsPanel />
                    </div>
                  )}
                  
                  {activeTab === "invite" && canManageTeams && (
                    <section className="signal-card p-6 max-w-3xl animate-fade-in">
                      <div className="mb-6">
                        <h2 className="text-base font-semibold text-ink">Invite People</h2>
                        <p className="text-sm text-muted mt-1">Add new members to your organization.</p>
                      </div>
                      <OrgInvitePanel orgId={org.id} />
                    </section>
                  )}
                </div>
              )}

              {activeTeam && (
                <CreateProjectModal
                  open={showProjectModal}
                  onClose={() => setShowProjectModal(false)}
                  onCreate={async (data) => {
                    try {
                      await createProjectApi({
                        name: data.name,
                        description: data.description,
                        organization_id: org.id,
                        team_id: activeTeam.id,
                      });
                      const refreshedProjects = await getProjects();
                      setProjects(refreshedProjects);
                      const refreshedDashboard = await getTeamDashboard(org.id, activeTeam.id);
                      setTeamDashboard(refreshedDashboard);
                    } catch (error) {
                      alert(error?.response?.data?.detail || error.message || "Failed to create project");
                      throw error;
                    }
                  }}
                  mode={projectModalMode}
                  organizationName={org.name}
                  teamName={activeTeam.name}
                />
              )}

              {activeTeam && showDeleteTeamDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteTeamDialog(false)} />
                  <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-white p-6 shadow-2xl">
                    <h3 className="text-lg font-semibold text-ink">Delete team</h3>
                    <p className="mt-2 text-sm text-muted">
                      Are you sure you want to delete {activeTeam.name}? This cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowDeleteTeamDialog(false)}
                        className="rounded-lg border border-hairline bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await store.deleteTeam(org.id, activeTeam.id);
                          setShowDeleteTeamDialog(false);
                          setActiveTeam(null);
                        }}
                        className="rounded-lg bg-flagged px-4 py-2 text-sm font-semibold text-white transition hover:bg-flagged/90"
                      >
                        Delete team
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showCreateOrg && (
        <OrgCreateModal
          onClose={() => setShowCreateOrg(false)}
          onCreate={async (body) => {
            const newOrg = await store.createOrg(body);
            setShowCreateOrg(false);
            navigate(`/organizations/${newOrg.id}`);
          }}
        />
      )}

      {showCreateTeam && org && (
        <TeamCreateModal
          orgProjects={orgProjects}
          onClose={() => setShowCreateTeam(false)}
          onCreate={async (body, selectedProjectIds = []) => {
            const newTeam = await store.createTeam(org.id, body);
            
            // Assign team to selected projects sequentially
            for (const projectId of selectedProjectIds) {
              await addTeamToProject(projectId, newTeam.id, "viewer");
            }
            
            // Refetch projects to update assigned_team_ids
            const updatedProjects = await getProjects();
            setProjects(updatedProjects);
            
            setShowCreateTeam(false);
          }}
        />
      )}
      <AppFooter />
    </div>
  );
}
