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
  options = {}
) {
  const response = await api.put(
    `/workspaces/${projectId}`,
    workspace,
    options
  );

  return response.data;
}