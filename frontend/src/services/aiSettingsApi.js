import api from "../api/api";

export async function getAISettings() {
  const response = await api.get("/ai-settings");
  return response.data;
}

export async function updateAISettings(payload) {
  const response = await api.put("/ai-settings", payload);
  return response.data;
}

export async function deleteProviderKey(provider) {
  const response = await api.delete(`/ai-settings/key/${provider}`);
  return response.data;
}
