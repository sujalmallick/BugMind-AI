import api from "./api";

// ---------- Project Knowledge (uploaded documents) ----------

export async function listDocuments(projectId) {
  const response = await api.get(`/projects/${projectId}/documents`);
  return response.data;
}

export async function uploadDocument(projectId, file) {
  const form = new FormData();
  form.append("file", file);
  // Same pattern as the avatar upload: axios fills in the multipart boundary.
  const response = await api.post(`/projects/${projectId}/documents`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function setDocumentAiEnabled(projectId, documentId, aiEnabled) {
  const response = await api.patch(`/projects/${projectId}/documents/${documentId}`, {
    ai_enabled: aiEnabled,
  });
  return response.data;
}

export async function retryDocument(projectId, documentId) {
  const response = await api.post(`/projects/${projectId}/documents/${documentId}/retry`);
  return response.data;
}

export async function deleteDocument(projectId, documentId) {
  await api.delete(`/projects/${projectId}/documents/${documentId}`);
}

export async function downloadDocument(projectId, doc) {
  const response = await api.get(`/projects/${projectId}/documents/${doc.id}/download`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.filename;
  link.click();
  // Revoking immediately can cancel the download in Firefox/Safari.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// AI-drafted workflow description from the project's documents ({ success, workflow, ... }).
export async function draftWorkflowFromDocuments(projectId, focus) {
  const response = await api.post(`/projects/${projectId}/documents/draft-workflow`, {
    focus: focus?.trim() || null,
  });
  return response.data;
}
