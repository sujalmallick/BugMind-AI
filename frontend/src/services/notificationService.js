import api from "./api";

export async function fetchNotifications(limit = 50, offset = 0) {
  const response = await api.get("/api/notifications", {
    params: { limit, offset }
  });
  return response.data;
}

export async function getUnreadCount() {
  const response = await api.get("/api/notifications/unread-count");
  return response.data.unread_count;
}

export async function markAsRead(notificationId) {
  const response = await api.patch(`/api/notifications/${notificationId}/read`);
  return response.data;
}

export async function markAllAsRead() {
  const response = await api.patch("/api/notifications/read-all");
  return response.data;
}

export async function deleteNotification(notificationId) {
  const response = await api.delete(`/api/notifications/${notificationId}`);
  return response.data;
}

export async function getPreferences() {
  const response = await api.get("/api/notifications/preferences");
  return response.data;
}

export async function updatePreference(typeStr, updateData) {
  const response = await api.put(`/api/notifications/preferences/${typeStr}`, updateData);
  return response.data;
}

export async function clearAllNotifications() {
  const response = await api.delete("/api/notifications/clear-all");
  return response.data;
}

export async function triggerTestNotification() {
  const response = await api.post("/api/notifications/test");
  return response.data;
}
