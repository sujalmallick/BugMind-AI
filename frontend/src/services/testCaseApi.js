import  api from "./api";

export async function saveTestCases(
  projectId,
  testCases,
) {
  const response = await api.put(
    `/test-cases/${projectId}`,
    {
      test_cases: testCases,
    }
  );

  return response.data;
}

export async function getTestCases(
  projectId,
) {
  const response = await api.get(
    `/test-cases/${projectId}`
  );

  return response.data;
}