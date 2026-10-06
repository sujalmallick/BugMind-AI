import { useState, useEffect } from "react";
import {
  Building2, Plus, Loader2, Users, Settings, ChevronRight, LayoutDashboard, UserPlus,
  Crown, ShieldCheck, User, Trash2, FolderKanban, ListChecks, Layers3
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import useOrgStore from "../store/useOrgStore";
import OrgCard from "../components/organization/OrgCard";
import OrgCreateModal from "../components/organization/OrgCreateModal";
import OrgMemberList from "../components/organization/OrgMemberList";
import PageHeading       from "../components/shared/PageHeading";
import Panel             from "../components/shared/Panel";
import Pill              from "../components/shared/Pill";
import EmptyState        from "../components/shared/EmptyState";
import SegmentedControl  from "../components/shared/SegmentedControl";
import ConfirmDialog     from "../components/shared/ConfirmDialog";
import Orbs              from "../components/shared/Orbs";
import TeamCard from "../components/organization/TeamCard";
import TeamCreateModal from "../components/organization/TeamCreateModal";
import TeamMemberList from "../components/organization/TeamMemberList";
import OrgSettingsPanel from "../components/organization/OrgSettingsPanel";
import OrgInvitePanel from "../components/organization/OrgInvitePanel";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import AppFooter from "../components/layout/AppFooter";
import HeaderBar from "../components/layout/HeaderBar";
import { createProject as createProjectApi, getProjects, addTeamToProject } from "../services/projectApi";
import { getTeamDashboard } from "../services/dashboardApi";

const ROLE_META = {
  owner:  { label: "Owner",  tone: "ochre",   icon: Crown },
  admin:  { label: "Admin",  tone: "signal",  icon: ShieldCheck },
  member: { label: "Member", tone: "neutral", icon: User },
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
  const roleLabel = ROLE_META[myRole]?.label || ROLE_META.member.label;
  const orgProjects = projects.filter((project) => project.organizationId === org?.id);
  const teamProjects = activeTeam ? orgProjects.filter(p => p.assigned_team_ids?.includes(activeTeam.id)) : [];
  const teamAssignments = teamDashboard?.member_load || [];

  // ── Header ────────────────────────────────────────────────────────────────

  if (store.loading && !org && !store.orgs.length) {
    return (
      <div className="workspace-atmosphere min-h-screen">
        <HeaderBar />
        <main className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-20 sm:px-6">
          <Loader2 size={24} className="spin text-signal" aria-label="Loading" />
        </main>
      </div>
    );
  }

  const teamMemberCount = activeTeam ? (store.teamMembers[activeTeam.id]?.length ?? 0) : 0;
  const totalAssignments = teamAssignments.reduce((sum, member) => sum + member.total, 0);
  const maxLoad = Math.max(1, ...teamAssignments.map((m) => m.total));

  const orgTabs = [
    { value: "teams", label: "Teams", icon: Layers3, count: store.teams.length },
    { value: "members", label: "Members", icon: Users, count: store.members.length },
    ...(canManageTeams ? [{ value: "invite", label: "Invite", icon: UserPlus }] : []),
    ...(isOwner ? [{ value: "settings", label: "Settings", icon: Settings }] : []),
  ];

  return (
    <div className="workspace-atmosphere min-h-screen flex flex-col">
      <HeaderBar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        {/* ── LIST VIEW ───────────────────────────────────────────────────── */}
        {!orgId ? (
          <>
            <div className="section-enter mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <PageHeading meta="Shared workspaces for your QA teams, members and projects.">
                Organizations
              </PageHeading>

              {store.orgs.length > 0 && (
                <button onClick={() => setShowCreateOrg(true)} className="btn-primary self-start sm:self-auto">
                  <Plus size={15} aria-hidden="true" /> New organization
                </button>
              )}
            </div>

            {store.orgs.length === 0 ? (
              <EmptyState
                className="section-enter section-enter-1 py-16"
                icon={<Building2 size={18} />}
                title="No organizations yet"
                description="Create an organization to collaborate with your QA team, organize members into teams and share projects."
                action={
                  <button onClick={() => setShowCreateOrg(true)} className="btn-primary">
                    <Plus size={14} aria-hidden="true" /> Create organization
                  </button>
                }
              />
            ) : (
              <div className="section-enter section-enter-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {store.orgs.map((o) => (
                  <OrgCard key={o.id} org={o} onClick={() => navigate(`/organizations/${o.id}`)} />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── DETAIL VIEW ────────────────────────────────────────────────── */
          org && (
            <div>
              {/* Breadcrumbs */}
              <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-[13px] text-muted">
                <button onClick={() => navigate("/organizations")} className="rounded px-1 py-0.5 transition-colors hover:text-ink">
                  Organizations
                </button>
                <ChevronRight size={13} aria-hidden="true" className="text-muted/60" />
                {activeTeam ? (
                  <>
                    <button onClick={() => setActiveTeam(null)} className="rounded px-1 py-0.5 transition-colors hover:text-ink">
                      {org.name}
                    </button>
                    <ChevronRight size={13} aria-hidden="true" className="text-muted/60" />
                    <span className="px-1 font-medium text-ink" aria-current="page">{activeTeam.name}</span>
                  </>
                ) : (
                  <span className="px-1 font-medium text-ink" aria-current="page">{org.name}</span>
                )}
              </nav>

              {/* ── Org overview ─────────────────────────────────────────── */}
              {!activeTeam && (
                <section className="glass-card section-enter mb-6 overflow-hidden !rounded-2xl">
                  <Orbs variant="panel" className="opacity-60" />
                  <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-signal-soft text-xl font-semibold text-signal ring-4 ring-surface">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          org.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="truncate text-2xl font-semibold tracking-[-0.025em] text-ink">{org.name}</h1>
                          <Pill tone={ROLE_META[myRole]?.tone || "neutral"} icon={RoleIcon}>{roleLabel}</Pill>
                        </div>
                        <p className="mt-0.5 font-mono text-[12px] text-muted">{org.slug}</p>
                        {org.description && (
                          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">{org.description}</p>
                        )}
                      </div>
                    </div>

                    <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-auto">
                      {[
                        { label: "Members", value: store.members.length || org.member_count || 0 },
                        { label: "Teams", value: store.teams.length },
                        { label: "Projects", value: orgProjects.length },
                      ].map((s) => (
                        <div key={s.label} className="glass rounded-xl px-4 py-3 text-center lg:min-w-[96px]">
                          <dd className="text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
                          <dt className="mt-0.5 text-[12px] text-muted">{s.label}</dt>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              )}

              {/* ── Team detail ──────────────────────────────────────────── */}
              {activeTeam ? (
                <div className="section-enter">
                  <section className="glass-card mb-6 overflow-hidden !rounded-2xl">
                    <Orbs variant="panel" className="opacity-50" />
                    <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-verified-soft text-verified ring-4 ring-surface">
                          <Users size={20} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="eyebrow">Team · {org.name}</p>
                          <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.025em] text-ink">{activeTeam.name}</h1>
                          <p className="mt-1 max-w-2xl text-[14px] text-muted">
                            {activeTeam.description || "Team members, project coverage and assignments in one place."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <dl className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Members", value: teamMemberCount },
                            { label: "Projects", value: teamProjects.length },
                            { label: "Assigned", value: totalAssignments },
                          ].map((s) => (
                            <div key={s.label} className="glass rounded-xl px-3.5 py-2.5 text-center">
                              <dd className="text-lg font-semibold tabular-nums text-ink">{s.value}</dd>
                              <dt className="text-[11px] text-muted">{s.label}</dt>
                            </div>
                          ))}
                        </dl>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/organizations/${org.id}/teams/${activeTeam.id}/dashboard`)}
                            className="btn-secondary flex-1 sm:flex-none"
                          >
                            <LayoutDashboard size={14} aria-hidden="true" />
                            Dashboard
                          </button>
                          {canManageTeams && (
                            <button
                              type="button"
                              onClick={() => setShowDeleteTeamDialog(true)}
                              aria-label="Delete team"
                              className="btn-secondary !px-2.5 text-flagged hover:!border-flagged/30 hover:!bg-flagged-soft"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Panel
                      title="Members"
                      description="People on this team"
                      action={canManageTeams && (() => {
                        const eligibleMembers = store.members.filter(m => !(store.teamMembers[activeTeam.id] || []).some(tm => tm.user_id === m.user_id));
                        return (
                          <select
                            aria-label="Add a member to this team"
                            className="field !min-h-0 !w-auto !py-1.5 !text-[13px]"
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
                              {eligibleMembers.length === 0 ? "Everyone's already on this team" : "+ Add member"}
                            </option>
                            {eligibleMembers.map(m => (
                              <option key={m.user_id} value={m.user_id}>{m.user?.name || m.user?.email}</option>
                            ))}
                          </select>
                        );
                      })()}
                    >
                      <TeamMemberList
                        members={store.teamMembers[activeTeam.id] ?? []}
                        currentUserId={user?.id}
                        canManage={canManageTeams}
                        onRemove={(uid) => store.removeTeamMember(org.id, activeTeam.id, uid)}
                      />
                    </Panel>

                    <Panel
                      title="Projects"
                      description="Projects linked to this team"
                      action={canManageTeams && (() => {
                        const assignableProjects = orgProjects.filter(p => !p.assigned_team_ids?.includes(activeTeam.id));
                        if (assignableProjects.length === 0) return null;
                        return (
                          <div className="flex items-center gap-2">
                            <select
                              aria-label="Organization project to assign"
                              value={assignProjectId}
                              onChange={(e) => setAssignProjectId(e.target.value)}
                              className="field !min-h-0 !w-auto !py-1.5 !text-[13px]"
                            >
                              <option value="">Assign project…</option>
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
                              className="btn-primary !min-h-0 !py-1.5"
                            >
                              {assigningProject ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                              Assign
                            </button>
                          </div>
                        );
                      })()}
                    >
                      {teamProjects.length > 0 ? (
                        <ul className="-mx-2 -my-1">
                          {teamProjects.map((project) => (
                            <li key={project.id}>
                              <button
                                type="button"
                                onClick={() => navigate(`/project/${project.id}/workspace`)}
                                className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-ink/[0.03]"
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-paper text-muted group-hover:text-signal">
                                  <FolderKanban size={15} aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-medium text-ink">{project.name}</span>
                                  <span className="block truncate text-[12px] text-muted">{project.description || "No description"}</span>
                                </span>
                                <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState
                          icon={<FolderKanban size={18} />}
                          title="No projects linked"
                          description="Assign an organization project so this team can work on its test cases."
                        />
                      )}
                    </Panel>

                    <Panel
                      title="Assignments"
                      description="Current load across the team"
                      className="xl:col-span-2"
                    >
                      {teamAssignments.length > 0 ? (
                        <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                          {teamAssignments.map((member) => (
                            <li key={member.user_id}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal-soft text-[11px] font-semibold text-signal">
                                    {(member.name || "?").charAt(0).toUpperCase()}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-[13px] font-medium text-ink">{member.name}</span>
                                    <span className="block text-[11px] capitalize text-muted">{String(member.role || "").replace(/_/g, " ")}</span>
                                  </span>
                                </div>
                                <span className="shrink-0 text-[12px] text-muted">
                                  <span className="font-semibold tabular-nums text-ink">{member.total}</span> items
                                </span>
                              </div>
                              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-hairline" aria-hidden="true">
                                <span className="h-full bg-signal" style={{ width: `${(member.test_cases / maxLoad) * 100}%` }} />
                                <span className="h-full bg-flagged/80" style={{ width: `${(member.issues / maxLoad) * 100}%` }} />
                              </div>
                              <p className="mt-1.5 text-[11px] text-muted">
                                {member.test_cases} test cases · {member.issues} issues
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState
                          icon={<ListChecks size={18} />}
                          title="No assignments yet"
                          description="Assign test cases or issues to team members from a project workspace."
                        />
                      )}
                    </Panel>
                  </div>
                </div>
              ) : (
                /* ── Org tabs ─────────────────────────────────────────────── */
                <div className="section-enter section-enter-1">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SegmentedControl
                      label="Organization sections"
                      options={orgTabs}
                      value={activeTab}
                      onChange={setActiveTab}
                    />
                    {activeTab === "teams" && canManageTeams && store.teams.length > 0 && (
                      <button onClick={() => setShowCreateTeam(true)} className="btn-secondary self-start sm:self-auto">
                        <Plus size={14} aria-hidden="true" /> Create team
                      </button>
                    )}
                  </div>

                  <div key={activeTab} className="animate-tab-enter">
                    {activeTab === "teams" && (
                      store.teams.length === 0 ? (
                        <EmptyState
                          icon={<Layers3 size={18} />}
                          title="No teams yet"
                          description="Group members by product area or role, then link the projects each team owns."
                          action={canManageTeams && (
                            <button onClick={() => setShowCreateTeam(true)} className="btn-primary">
                              <Plus size={14} aria-hidden="true" /> Create the first team
                            </button>
                          )}
                        />
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {store.teams.map((team) => (
                            <TeamCard key={team.id} team={team} onClick={() => setActiveTeam(team)} />
                          ))}
                        </div>
                      )
                    )}

                    {activeTab === "members" && (
                      <Panel
                        title="Organization members"
                        description="Manage roles and access for everyone in this organization"
                        className="max-w-4xl"
                      >
                        <OrgMemberList
                          members={store.members}
                          currentUserId={user?.id}
                          myRole={myRole}
                          onRoleChange={(uid, role) => store.changeMemberRole(org.id, uid, role)}
                          onRemove={(uid) => store.removeMember(org.id, uid)}
                        />
                      </Panel>
                    )}

                    {activeTab === "settings" && isOwner && (
                      <div className="max-w-4xl">
                        <OrgSettingsPanel />
                      </div>
                    )}

                    {activeTab === "invite" && canManageTeams && (
                      <Panel
                        title="Invite people"
                        description="Add new members to your organization by email or invite link"
                        className="max-w-4xl"
                      >
                        <OrgInvitePanel orgId={org.id} />
                      </Panel>
                    )}
                  </div>
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

              {activeTeam && (
                <ConfirmDialog
                  open={showDeleteTeamDialog}
                  title="Delete team?"
                  message={`Delete ${activeTeam.name}? Members stay in the organization, but this team and its project links are removed. This can't be undone.`}
                  confirmText="Delete team"
                  onConfirm={async () => {
                    await store.deleteTeam(org.id, activeTeam.id);
                    setShowDeleteTeamDialog(false);
                    setActiveTeam(null);
                  }}
                  onCancel={() => setShowDeleteTeamDialog(false)}
                />
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
