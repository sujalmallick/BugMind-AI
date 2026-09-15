import api from "../services/api";

export function getAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) {
    return avatarPath;
  }
  const baseUrl = (api.defaults.baseURL || import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const cleanPath = avatarPath.replace(/^\//, "");
  return `${baseUrl}/${cleanPath}`;
}
