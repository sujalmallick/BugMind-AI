import API_BASE_URL from "./api";

export async function saveAnalysis(
  projectId,
  result,
) {
  const response = await fetch(
    `${API_BASE_URL}/analysis/${projectId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        result,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to save analysis");
  }

  return response.json();
}

export async function getAnalysis(
  projectId,
) {
  const response = await fetch(
    `${API_BASE_URL}/analysis/${projectId}`
  );

  if (!response.ok) {
    throw new Error("Failed to load analysis");
  }

  return response.json();
}