import api from "./api";

export async function getWorkspace(projectId) {
  const response = await api.get(
    `/workspaces/${projectId}`
  );

  return response.data;
}

export async function updateWorkspace(
  projectId,
  workspace,
) {
  const response = await api.put(
    `/workspaces/${projectId}`,
    workspace,
  );

  return response.data;
}