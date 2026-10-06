import api from "./api";

// ---------- AI Test Planning ----------

export async function listTestPlans(projectId) {
  const response = await api.get(`/projects/${projectId}/test-plans`);
  return response.data;
}

// { success, plan } or { success: false, error } (AI / safety errors come back as 200).
export async function createTestPlan(projectId, scope, title) {
  const response = await api.post(`/projects/${projectId}/test-plans`, { scope, title: title || null });
  return response.data;
}

export async function deleteTestPlan(projectId, planId) {
  await api.delete(`/projects/${projectId}/test-plans/${planId}`);
}

export async function updateTestPlanPhase(projectId, planId, phaseId, patch) {
  const response = await api.patch(`/projects/${projectId}/test-plans/${planId}/phases/${phaseId}`, patch);
  return response.data;
}

// { success, phase, testCases } or { success: false, error }.
export async function generatePhaseTestCases(projectId, planId, phaseId) {
  const response = await api.post(`/projects/${projectId}/test-plans/${planId}/phases/${phaseId}/generate`);
  return response.data;
}
