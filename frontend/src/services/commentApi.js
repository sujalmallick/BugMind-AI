import apiClient from "./api";

export const getComments = async (entityType, entityId) => {
  const res = await apiClient.get("/api/comments/", {
    params: { entity_type: entityType, entity_id: entityId }
  });
  return res.data;
};

export const createComment = async (data) => {
  const res = await apiClient.post("/api/comments/", data);
  return res.data;
};

export const updateComment = async (commentId, body) => {
  const res = await apiClient.put(`/api/comments/${commentId}`, { body });
  return res.data;
};

export const deleteComment = async (commentId) => {
  await apiClient.delete(`/api/comments/${commentId}`);
};

export const addReaction = async (commentId, emoji) => {
  await apiClient.post(`/api/comments/${commentId}/reactions`, { emoji });
};

export const removeReaction = async (commentId, emoji) => {
  await apiClient.delete(`/api/comments/${commentId}/reactions/${emoji}`);
};
