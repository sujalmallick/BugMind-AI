import api from "./api";

export async function getMyDashboard() {
  const response = await api.get("/api/dashboard/me");
  return response.data;
}

export async function getProjectDashboard(projectId) {
  const response = await api.get(`/api/dashboard/projects/${projectId}`);
  return response.data;
}

export async function getTeamDashboard(orgId, teamId) {
  const response = await api.get(
    `/api/dashboard/organizations/${orgId}/teams/${teamId}`
  );
  return response.data;
}