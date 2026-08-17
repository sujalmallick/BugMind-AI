import { useState, useEffect, useCallback, useMemo } from "react";
import { Users, User, X, Loader2, Link2, Clock, Trash2, Copy, Check, Send, Plus, ArrowRightLeft } from "lucide-react";
import { fetchProjectMembers, addProjectMember, removeProjectMember, fetchProjectTeams, addProjectTeam, removeProjectTeam } from "../../api/projectShareApi";
import { createInvitation, listInvitations, revokeInvitation } from "../../api/invitationApi";
import { transferProjectToOrg } from "../../services/projectApi";
import useOrgStore from "../../store/useOrgStore";
import useToasts from "../shared/useToasts";

export default function ShareProjectModal({ project, onClose }) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const { showToast } = useToasts();
  const store = useOrgStore();
  const loadOrg = useOrgStore((s) => s.loadOrg);
  const loadOrgs = useOrgStore((s) => s.loadOrgs);
  const storeOrgs = useOrgStore((s) => s.orgs);
  const storeMembers = useOrgStore((s) => s.members);
  const storeTeams = useOrgStore((s) => s.teams);
  const activeOrg = useOrgStore((s) => s.activeOrg);

  // Invite state
  const [inviteRole, setInviteRole] = useState("viewer");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);

  // Add member / team state
  const [newMemberId, setNewMemberId] = useState("");
  const [newTeamId, setNewTeamId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [addingTeam, setAddingTeam] = useState(false);

  // Transfer state
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferred, setTransferred] = useState(false);

  const userOrgs = storeOrgs ?? [];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [mems, tms, pending] = await Promise.all([
        fetchProjectMembers(project.id),
        fetchProjectTeams(project.id),
        listInvitations("project", project.id),
      ]);
      setMembers(mems);
      setTeams(tms);
      setInvites(pending);
      if (project.organizationId) {
        await loadOrg(project.organizationId);
      }
      if (!storeOrgs?.length) {
        await loadOrgs();
      }
    } catch (err) {
      showToast(err.message || "Failed to load sharing data");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.organizationId]);

  useEffect(() => { loadData(); }, [loadData]);

  const availableMembers = useMemo(() => {
    if (!project.organizationId || activeOrg?.id !== project.organizationId) return [];
    return storeMembers.filter((m) => !members.some((pm) => pm.user_id === m.user_id));
  }, [members, project.organizationId, activeOrg?.id, storeMembers]);

  const availableTeams = useMemo(() => {
    if (!project.organizationId || activeOrg?.id !== project.organizationId) return [];
    return storeTeams.filter((t) => !teams.some((pt) => pt.team_id === t.id));
  }, [project.organizationId, activeOrg?.id, storeTeams, teams]);

  const isOrgProject = !!(project.organizationId && activeOrg?.id === project.organizationId);

  const handleAddMember = async () => {
    if (!newMemberId) return;
    setAddingMember(true);
    try {
      const added = await addProjectMember(project.id, { user_id: parseInt(newMemberId, 10), role: "viewer" });
      setMembers((prev) => [...prev, added]);
      setNewMemberId("");
      showToast("Member added");
    } catch (err) { showToast(err.message); }
    finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeProjectMember(project.id, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      showToast("Member removed");
    } catch (err) { showToast(err.message); }
  };

  const handleAddTeam = async () => {
    if (!newTeamId) return;
    setAddingTeam(true);
    try {
      const added = await addProjectTeam(project.id, { team_id: parseInt(newTeamId, 10), role: "viewer" });
      setTeams((prev) => [...prev, added]);
      setNewTeamId("");
      showToast("Team added");
    } catch (err) { showToast(err.message); }
    finally { setAddingTeam(false); }
  };

  const handleRemoveTeam = async (teamId) => {
    try {
      await removeProjectTeam(project.id, teamId);
      setTeams((prev) => prev.filter((t) => t.team_id !== teamId));
      showToast("Team removed");
    } catch (err) { showToast(err.message); }
  };


  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const inv = await createInvitation({ type: "project", target_id: project.id, role: inviteRole });
      setInvites((prev) => [inv, ...prev]);
      const link = `${window.location.origin}/invite/${inv.token}`;
      await navigator.clipboard.writeText(link);
      setCopiedToken(inv.token);
      setTimeout(() => setCopiedToken(null), 3000);
      showToast("Link copied to clipboard!");
    } catch (err) { showToast(err.message); }
    finally { setGeneratingLink(false); }
  };

  const handleCopyLink = async (token) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
    showToast("Link copied!");
  };

  const handleRevokeInvite = async (token) => {
    try {
      await revokeInvitation(token);
      setInvites((prev) => prev.filter((i) => i.token !== token));
      showToast("Invitation revoked");
    } catch (err) { showToast(err.message); }
  };

  const handleTransfer = async () => {
    if (!selectedOrgId) return;
    if (!window.confirm("This will move the project into the selected organization. Team access and sharing controls will become available. Continue?")) return;
    setTransferring(true);
    try {
      await transferProjectToOrg(project.id, parseInt(selectedOrgId, 10));
      setTransferred(true);
      showToast("Project transferred! Reload the page to see changes.");
    } catch (err) {
      showToast(err.message || "Transfer failed.");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm modal-backdrop-enter" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] modal-pop-enter">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4 bg-white shrink-0">
          <div>
            <h2 className="text-lg font-bold text-ink">Share Project</h2>
            <p className="text-xs text-muted mt-0.5 truncate max-w-[340px]">{project.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-surface hover:text-ink transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5 bg-paper/40 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-muted" size={26} />
            </div>
          ) : (
            <>
              {/* ── Project Access Section ── */}
              <section className="rounded-2xl border border-hairline bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-hairline bg-surface/50">
                  <h3 className="text-sm font-semibold text-ink">Project Access</h3>
                  <p className="text-xs text-muted mt-0.5">Manage who has direct access to this project.</p>
                </div>

                <div className="p-5 space-y-5">

                  {/* Members subsection */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Members</h4>
                      {isOrgProject && availableMembers.length > 0 && (
                        <div className="flex items-center gap-2">
                          <select
                            value={newMemberId}
                            onChange={(e) => setNewMemberId(e.target.value)}
                            className="rounded-lg border border-hairline bg-paper px-2.5 py-1.5 text-xs focus:outline-none focus:border-signal"
                          >
                            <option value="">Select member…</option>
                            {availableMembers.map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.user?.name || m.user?.email}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!newMemberId || addingMember}
                            onClick={handleAddMember}
                            className="inline-flex items-center gap-1 rounded-lg bg-signal px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition"
                          >
                            {addingMember ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {!isOrgProject && !project.organizationId ? (
                      <p className="text-xs text-muted bg-surface rounded-lg px-3 py-2 border border-hairline">
                        Transfer this project to an organization to add team members directly.
                      </p>
                    ) : members.length === 0 ? (
                      <p className="text-xs text-muted text-center py-5">No direct members yet.</p>
                    ) : (
                      <div className="divide-y divide-hairline rounded-xl border border-hairline overflow-hidden">
                        {members.map((member) => (
                          <div key={member.user_id} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-surface/50 transition">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-sm font-bold text-ink">
                                {member.user?.name ? member.user.name.charAt(0).toUpperCase() : <User size={14} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink truncate">{member.user?.name || "Unknown"}</p>
                                <p className="text-xs text-muted truncate">{member.user?.email}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="ml-3 shrink-0 flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition"
                            >
                              <Trash2 size={11} />
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Teams subsection */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Teams</h4>
                      {isOrgProject && availableTeams.length > 0 && (
                        <div className="flex items-center gap-2">
                          <select
                            value={newTeamId}
                            onChange={(e) => setNewTeamId(e.target.value)}
                            className="rounded-lg border border-hairline bg-paper px-2.5 py-1.5 text-xs focus:outline-none focus:border-signal"
                          >
                            <option value="">Select team…</option>
                            {availableTeams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!newTeamId || addingTeam}
                            onClick={handleAddTeam}
                            className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-50 hover:bg-surface transition"
                          >
                            {addingTeam ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {!isOrgProject && !project.organizationId ? null : teams.length === 0 ? (
                      <p className="text-xs text-muted text-center py-5">No teams have access yet.</p>
                    ) : (
                      <div className="divide-y divide-hairline rounded-xl border border-hairline overflow-hidden">
                        {teams.map((team) => (
                          <div key={team.team_id} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-surface/50 transition">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface">
                                <Users size={14} className="text-muted" />
                              </div>
                              <p className="text-sm font-medium text-ink truncate">{team.team?.name}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveTeam(team.team_id)}
                              className="ml-3 shrink-0 flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition"
                            >
                              <Trash2 size={11} />
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ── Invite Access Section ── */}
              <section className="rounded-2xl border border-hairline bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-hairline bg-surface/50">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Invite Access</h3>
                      <p className="text-xs text-muted mt-0.5">Send a link or email invite with a chosen role.</p>
                    </div>
                    <div className="flex gap-1.5">
                      {["viewer", "editor", "admin"].map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setInviteRole(role)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${inviteRole === role ? "border-signal bg-signal/10 text-signal" : "border-hairline text-muted hover:border-ink/30"}`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-3">

                  <button
                    onClick={handleGenerateLink}
                    disabled={generatingLink}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-hairline bg-surface py-2.5 text-sm font-semibold text-ink hover:bg-paper transition disabled:opacity-50"
                  >
                    {generatingLink ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                    Generate link
                  </button>

                  {invites.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {invites.map((inv) => (
                        <div key={inv.token} className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-3 py-2.5">
                          <Clock size={13} className="text-muted shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{inv.invited_email || "Share link"}</p>
                            <p className="text-xs text-muted">{inv.role} · expires {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "never"}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!inv.invited_email && (
                              <button
                                onClick={() => handleCopyLink(inv.token)}
                                className="rounded-lg p-1.5 text-muted hover:text-signal hover:bg-signal/5 transition"
                                title="Copy link"
                              >
                                {copiedToken === inv.token ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                              </button>
                            )}
                            <button
                              onClick={() => handleRevokeInvite(inv.token)}
                              className="rounded-lg p-1.5 text-muted hover:text-red-500 hover:bg-red-50 transition"
                              title="Revoke"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Transfer to Organization (personal projects only) ── */}
              {!project.organizationId && (
                <section className="rounded-2xl border border-hairline bg-white overflow-hidden">
                  <div className="px-5 py-4 border-b border-hairline bg-surface/50">
                    <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                      <ArrowRightLeft size={14} className="text-muted" />
                      Transfer to Organization
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Move this project into an organization to enable team collaboration.
                    </p>
                  </div>
                  <div className="p-5">
                    {transferred ? (
                      <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
                        ✅ Transferred! Reload the page to see the updated project.
                      </div>
                    ) : userOrgs.length === 0 ? (
                      <div className="rounded-xl border border-hairline bg-surface px-4 py-3 text-xs text-muted">
                        You are not a member of any organization yet.
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={selectedOrgId}
                          onChange={(e) => setSelectedOrgId(e.target.value)}
                          className="flex-1 min-w-0 rounded-lg border border-hairline bg-paper px-3 py-2 text-sm focus:outline-none focus:border-signal"
                        >
                          <option value="">Select organization…</option>
                          {userOrgs.map((org) => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedOrgId || transferring}
                          onClick={handleTransfer}
                          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-signal px-4 py-2 text-sm font-bold text-white hover:bg-signal/90 transition disabled:opacity-50"
                        >
                          {transferring ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={13} />}
                          Transfer
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
