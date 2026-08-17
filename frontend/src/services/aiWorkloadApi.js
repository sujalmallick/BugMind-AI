import api from "./api";

export async function suggestAssignments(projectId) {
  const response = await api.post(`/projects/${projectId}/ai/suggest-assignments`);
  return response.data;
}

export async function getLatestSuggestion(projectId) {
  const response = await api.get(`/projects/${projectId}/ai/suggestions`);
  return response.data;
}

export async function applySuggestions(projectId, suggestionId, selectedIndices) {
  const response = await api.post(`/projects/${projectId}/ai/suggestions/${suggestionId}/apply`, {
    selected_indices: selectedIndices
  });
  return response.data;
}

export async function dismissSuggestion(projectId, suggestionId) {
  const response = await api.delete(`/projects/${projectId}/ai/suggestions/${suggestionId}`);
  return response.data;
}
