import api from "../services/api";

export const fetchProjectMembers = async (projectId) => {
  const res = await api.get(`/projects/${projectId}/members`);
  return res.data;
};

export const addProjectMember = async (projectId, body) => {
  const res = await api.post(`/projects/${projectId}/members`, body);
  return res.data;
};

export const removeProjectMember = async (projectId, userId) => {
  const res = await api.delete(`/projects/${projectId}/members/${userId}`);
  return res.data;
};

export const fetchProjectTeams = async (projectId) => {
  const res = await api.get(`/projects/${projectId}/teams`);
  return res.data;
};

export const fetchProjectAssignees = async (projectId) => {
  const res = await api.get(`/projects/${projectId}/assignees`);
  return res.data;
};

export const addProjectTeam = async (projectId, body) => {
  const res = await api.post(`/projects/${projectId}/teams`, body);
  return res.data;
};

export const removeProjectTeam = async (projectId, teamId) => {
  const res = await api.delete(`/projects/${projectId}/teams/${teamId}`);
  return res.data;
};
