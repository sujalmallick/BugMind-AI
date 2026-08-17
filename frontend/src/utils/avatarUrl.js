import api from "../services/api";

export function getAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
    return avatarPath;
  }
  const baseUrl = (api.defaults.baseURL || "http://localhost:8000").replace(/\/$/, "");
  const cleanPath = avatarPath.replace(/^\//, "");
  return `${baseUrl}/${cleanPath}`;
}
