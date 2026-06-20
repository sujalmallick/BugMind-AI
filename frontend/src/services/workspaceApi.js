import API_BASE_URL from "./api";

export async function getWorkspace(projectId) {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${projectId}`
  );

  if (!response.ok) {
    throw new Error("Failed to load workspace");
  }

  return response.json();
}

export async function updateWorkspace(
  projectId,
  workspace,
) {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${projectId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(workspace),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to save workspace");
  }

  return response.json();
}