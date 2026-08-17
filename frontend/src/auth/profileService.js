import api from "../api/api";
import { saveToken } from "./authService";

/**
 * Fetch the full profile for the current user from GET /api/me.
 */
export async function getProfile() {
  const response = await api.get("/api/me");
  return response.data;
}

/**
 * Update profile fields (name, avatar=null to clear avatar).
 */
export async function patchProfile(fields) {
  const response = await api.patch("/api/me", fields);
  return response.data;
}

/**
 * Upload a new avatar image. Returns { avatar_url }.
 */
export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/api/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

/**
 * Change password. On success, saves the new token and returns it.
 */
export async function changePassword(currentPassword, newPassword) {
  const response = await api.post("/api/me/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  // The backend returns a fresh token; persist it so subsequent requests stay valid.
  if (response.data.access_token) {
    saveToken(response.data.access_token);
  }
  return response.data;
}

/**
 * Soft-delete the current account after password confirmation.
 */
export async function deleteAccount(currentPassword) {
  const response = await api.delete("/api/me", {
    data: { current_password: currentPassword },
  });
  return response.data;
}
