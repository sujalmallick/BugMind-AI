import api from "./api";

// ---------- E2E automation: environments and scripts ----------

const base = (projectId) => `/projects/${projectId}/automation`;

export async function listEnvironments(projectId) {
  return (await api.get(`${base(projectId)}/environments`)).data;
}

export async function createEnvironment(projectId, data) {
  return (await api.post(`${base(projectId)}/environments`, data)).data;
}

export async function updateEnvironment(projectId, envId, data) {
  return (await api.patch(`${base(projectId)}/environments/${envId}`, data)).data;
}

export async function deleteEnvironment(projectId, envId) {
  await api.delete(`${base(projectId)}/environments/${envId}`);
}

export async function listScripts(projectId) {
  return (await api.get(`${base(projectId)}/scripts`)).data;
}

export async function getScript(projectId, scriptId) {
  return (await api.get(`${base(projectId)}/scripts/${scriptId}`)).data;
}

export async function createScript(projectId, data) {
  return (await api.post(`${base(projectId)}/scripts`, data)).data;
}

// { success, script } or { success: false, error } (AI errors come back as 200).
export async function generateScript(projectId, testCaseId, environmentId) {
  return (await api.post(`${base(projectId)}/scripts/generate`, {
    test_case_id: testCaseId, environment_id: environmentId,
  })).data;
}

export async function updateScript(projectId, scriptId, data) {
  return (await api.patch(`${base(projectId)}/scripts/${scriptId}`, data)).data;
}

export async function deleteScript(projectId, scriptId) {
  await api.delete(`${base(projectId)}/scripts/${scriptId}`);
}

// FastAPI errors: a string detail, or a list of validation errors.
export function apiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return error?.response?.data?.error || fallback;
}
