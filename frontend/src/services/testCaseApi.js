import API_BASE_URL from "./api";

export async function saveTestCases(
  projectId,
  testCases,
) {
  const response = await fetch(
    `${API_BASE_URL}/test-cases/${projectId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        test_cases: testCases,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to save test cases");
  }

  return response.json();
}

export async function getTestCases(
  projectId,
) {
  const response = await fetch(
    `${API_BASE_URL}/test-cases/${projectId}`
  );

  if (!response.ok) {
    throw new Error("Failed to load test cases");
  }

  return response.json();
}