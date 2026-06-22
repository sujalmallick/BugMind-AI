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