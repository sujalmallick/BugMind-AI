/**
 * store/useOrgStore.js
 *
 * Zustand store for organizations and teams.
 * Provides global state so OrganizationsPage, ProfilePage (orgs tab),
 * and any future org-aware component can share data without prop-drilling.
 */

import { create } from "zustand";
import {
  fetchOrgs,
  fetchOrg,
  createOrg,
  updateOrg,
  deleteOrg,
  fetchOrgMembers,
  changeOrgMemberRole,
  removeOrgMember,
  fetchTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  fetchTeamMembers,
  addTeamMember,
  removeTeamMember,
} from "../api/organizationApi";

const useOrgStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  orgs: [],           // list of org summaries for the current user
  activeOrg: null,    // fully-loaded org detail
  members: [],        // members of activeOrg
  teams: [],          // teams of activeOrg
  teamMembers: {},    // { [teamId]: [...members] }
  loading: false,
  error: null,

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Load all orgs for the logged-in user */
  loadOrgs: async () => {
    set({ loading: true, error: null });
    try {
      const orgs = await fetchOrgs();
      set({ orgs, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  /** Load a single org + its members + teams */
  loadOrg: async (orgId) => {
    set({ loading: true, error: null });
    try {
      const [org, members, teams] = await Promise.all([
        fetchOrg(orgId),
        fetchOrgMembers(orgId),
        fetchTeams(orgId),
      ]);
      set({ activeOrg: org, members, teams, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  /** Create org — appends to list and sets it as active */
  createOrg: async (body) => {
    const org = await createOrg(body);
    set((s) => ({ orgs: [org, ...s.orgs], activeOrg: org, members: [], teams: [] }));
    return org;
  },

  /** Update org name/description/logo */
  updateOrg: async (orgId, body) => {
    const updated = await updateOrg(orgId, body);
    set((s) => ({
      orgs: s.orgs.map((o) => (o.id === orgId ? updated : o)),
      activeOrg: s.activeOrg?.id === orgId ? updated : s.activeOrg,
    }));
    return updated;
  },

  /** Soft-delete an org */
  deleteOrg: async (orgId) => {
    await deleteOrg(orgId);
    set((s) => ({
      orgs: s.orgs.filter((o) => o.id !== orgId),
      activeOrg: s.activeOrg?.id === orgId ? null : s.activeOrg,
    }));
  },

  /** Member management ───────────────────────────────────────────────────── */

  changeMemberRole: async (orgId, userId, role) => {
    const updated = await changeOrgMemberRole(orgId, userId, role);
    set((s) => ({
      members: s.members.map((m) =>
        m.user_id === userId ? { ...m, role: updated.role } : m
      ),
    }));
  },

  removeMember: async (orgId, userId) => {
    await removeOrgMember(orgId, userId);
    set((s) => ({ members: s.members.filter((m) => m.user_id !== userId) }));
  },

  /** Team management ─────────────────────────────────────────────────────── */

  createTeam: async (orgId, body) => {
    const team = await createTeam(orgId, body);
    set((s) => ({ teams: [...s.teams, team] }));
    return team;
  },

  updateTeam: async (orgId, teamId, body) => {
    const updated = await updateTeam(orgId, teamId, body);
    set((s) => ({
      teams: s.teams.map((t) => (t.id === teamId ? updated : t)),
    }));
  },

  deleteTeam: async (orgId, teamId) => {
    await deleteTeam(orgId, teamId);
    set((s) => ({ teams: s.teams.filter((t) => t.id !== teamId) }));
  },

  loadTeamMembers: async (orgId, teamId) => {
    const members = await fetchTeamMembers(orgId, teamId);
    set((s) => ({ teamMembers: { ...s.teamMembers, [teamId]: members } }));
    return members;
  },

  addTeamMember: async (orgId, teamId, body) => {
    const member = await addTeamMember(orgId, teamId, body);
    set((s) => ({
      teamMembers: {
        ...s.teamMembers,
        [teamId]: [...(s.teamMembers[teamId] || []), member],
      },
    }));
  },

  removeTeamMember: async (orgId, teamId, userId) => {
    await removeTeamMember(orgId, teamId, userId);
    set((s) => ({
      teamMembers: {
        ...s.teamMembers,
        [teamId]: (s.teamMembers[teamId] || []).filter((m) => m.user_id !== userId),
      },
    }));
  },

  /** Reset all state (on logout) */
  reset: () =>
    set({ orgs: [], activeOrg: null, members: [], teams: [], teamMembers: {}, loading: false, error: null }),
}));

export default useOrgStore;
