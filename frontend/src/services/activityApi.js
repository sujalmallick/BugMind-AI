import apiClient from "./api";

export const getProjectActivity = (projectId, page = 1, limit = 30) => {
  return apiClient.get(`/api/activity/projects/${projectId}`, {
    params: { page, limit },
  });
};

export const getMyActivity = (page = 1, limit = 30) => {
  return apiClient.get("/api/activity/me", {
    params: { page, limit },
  });
};
