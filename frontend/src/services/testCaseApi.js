import api from "./api";

export async function saveTestCases(projectId, testCases) {
  const response = await api.put(`/test-cases/${projectId}`, { test_cases: testCases });
  return response.data;
}

export async function getTestCases(projectId) {
  const response = await api.get(`/test-cases/${projectId}`);
  return response.data;
}

export async function createManualTestCase(projectId, data) {
  const response = await api.post(`/test-cases/${projectId}/manual`, data);
  return response.data;
}

export async function updateTestCase(projectId, tcId, data) {
  const response = await api.put(`/test-cases/${projectId}/${tcId}`, data);
  return response.data;
}

export async function deleteTestCase(projectId, tcId) {
  const response = await api.delete(`/test-cases/${projectId}/${tcId}`);
  return response.data;
}