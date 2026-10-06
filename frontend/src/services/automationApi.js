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

// ---------- Export and results (tests run on the user's machine or their own CI) ----------

function filenameFrom(response, fallback) {
  const header = response.headers?.["content-disposition"] || "";
  const match = header.match(/filename="([^"]+)"/);
  return match ? match[1] : fallback;
}

// Downloads a file the API returns. Error bodies arrive as a Blob too: turn them back into
// JSON so apiErrorMessage() can show the server's message.
async function download(url, fallbackName) {
  let response;
  try {
    response = await api.get(url, { responseType: "blob" });
  } catch (error) {
    const body = error?.response?.data;
    if (body instanceof Blob) {
      try {
        error.response.data = JSON.parse(await body.text());
      } catch {
        // not JSON: keep the generic message
      }
    }
    throw error;
  }
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filenameFrom(response, fallbackName);
  link.click();
  // Revoking immediately can cancel the download in Firefox/Safari.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export function exportScript(projectId, scriptId) {
  return download(`${base(projectId)}/scripts/${scriptId}/export`, `bugmind-script-${scriptId}.spec.ts`);
}

export function exportProject(projectId, envId) {
  return download(`${base(projectId)}/environments/${envId}/export`, "bugmind-e2e.zip");
}

export async function listRuns(projectId) {
  return (await api.get(`${base(projectId)}/runs`)).data;
}

export async function getRun(projectId, runId) {
  return (await api.get(`${base(projectId)}/runs/${runId}`)).data;
}

export async function importResults(projectId, file) {
  const form = new FormData();
  form.append("file", file);
  return (await api.post(`${base(projectId)}/runs/import`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })).data;
}
