import API_BASE_URL from "./api";

export async function saveIssue(
  projectId,
  issue,
) {
  const response = await fetch(
    `${API_BASE_URL}/issues/${projectId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        issue,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to save issue");
  }

  return response.json();
}

export async function getIssues(
  projectId,
) {
  const response = await fetch(
    `${API_BASE_URL}/issues/${projectId}`
  );

  if (!response.ok) {
    throw new Error("Failed to load issues");
  }

  return response.json();
}