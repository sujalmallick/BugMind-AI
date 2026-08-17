import api from "../services/api";

// ── Organizations ────────────────────────────────────────────────────────────

export const fetchOrgs = async () => {
  const res = await api.get("/api/organizations/");
  return res.data;
};

export const fetchOrg = async (orgId) => {
  const res = await api.get(`/api/organizations/${orgId}`);
  return res.data;
};

export const createOrg = async (body) => {
  const res = await api.post("/api/organizations/", body);
  return res.data;
};

export const updateOrg = async (orgId, body) => {
  const res = await api.put(`/api/organizations/${orgId}`, body);
  return res.data;
};

export const deleteOrg = async (orgId) => {
  const res = await api.delete(`/api/organizations/${orgId}`);
  return res.data;
};

// ── Members ──────────────────────────────────────────────────────────────────

export const fetchOrgMembers = async (orgId) => {
  const res = await api.get(`/api/organizations/${orgId}/members`);
  return res.data;
};

export const changeOrgMemberRole = async (orgId, userId, role) => {
  const res = await api.put(`/api/organizations/${orgId}/members/${userId}/role`, { role });
  return res.data;
};

export const removeOrgMember = async (orgId, userId) => {
  const res = await api.delete(`/api/organizations/${orgId}/members/${userId}`);
  return res.data;
};

// ── Teams ────────────────────────────────────────────────────────────────────

export const fetchTeams = async (orgId) => {
  const res = await api.get(`/api/organizations/${orgId}/teams`);
  return res.data;
};

export const fetchTeam = async (orgId, teamId) => {
  const res = await api.get(`/api/organizations/${orgId}/teams/${teamId}`);
  return res.data;
};

export const createTeam = async (orgId, body) => {
  const res = await api.post(`/api/organizations/${orgId}/teams`, body);
  return res.data;
};

export const updateTeam = async (orgId, teamId, body) => {
  const res = await api.put(`/api/organizations/${orgId}/teams/${teamId}`, body);
  return res.data;
};

export const deleteTeam = async (orgId, teamId) => {
  const res = await api.delete(`/api/organizations/${orgId}/teams/${teamId}`);
  return res.data;
};

// ── Team Members ─────────────────────────────────────────────────────────────

export const fetchTeamMembers = async (orgId, teamId) => {
  const res = await api.get(`/api/organizations/${orgId}/teams/${teamId}/members`);
  return res.data;
};

export const addTeamMember = async (orgId, teamId, body) => {
  const res = await api.post(`/api/organizations/${orgId}/teams/${teamId}/members`, body);
  return res.data;
};

export const removeTeamMember = async (orgId, teamId, userId) => {
  const res = await api.delete(`/api/organizations/${orgId}/teams/${teamId}/members/${userId}`);
  return res.data;
};
