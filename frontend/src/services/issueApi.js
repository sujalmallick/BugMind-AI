import api from "./api";

export async function saveIssue(
  projectId,
  issue,
) {
  const response = await api.post(
    `/issues/${projectId}`,
    {
      issue,
    }
  );

  return response.data;
}

export async function getIssues(
  projectId,
) {
  const response = await api.get(
    `/issues/${projectId}`
  );

  return response.data;
}

export async function updateIssue(projectId, issueId, data) {
  const response = await api.put(`/issues/${projectId}/${issueId}`, data);
  return response.data;
}

export async function deleteIssue(projectId, issueId) {
  const response = await api.delete(`/issues/${projectId}/${issueId}`);
  return response.data;
}