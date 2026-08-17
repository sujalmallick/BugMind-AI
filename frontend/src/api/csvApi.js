import api from "./api";

export async function bulkImportTestCases(projectId, testCases) {
  const { data } = await api.post(`/test-cases/${projectId}/bulk-import`, {
    test_cases: testCases,
  });
  return data;
}

export async function bulkImportIssues(projectId, issues) {
  const { data } = await api.post(`/issues/${projectId}/bulk-import`, {
    issues,
  });
  return data;
}
