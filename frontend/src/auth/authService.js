import api from "../api/api";

const TOKEN_KEY = "bugmind_token";

export async function register(data) {
  const response = await api.post(
    "/auth/register",
    data
  );

  return response.data;
}

export async function login(
  email,
  password
) {
  const formData = new URLSearchParams();

  formData.append("username", email);
  formData.append("password", password);

  const response = await api.post(
    "/auth/login",
    formData,
    {
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
    }
  );

  saveToken(
    response.data.access_token
  );

  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get(
    "/auth/me"
  );

  return response.data;
}

export function saveToken(token) {
  localStorage.setItem(
    TOKEN_KEY,
    token
  );
}

export function getToken() {
  return localStorage.getItem(
    TOKEN_KEY
  );
}

export function logout() {
  localStorage.removeItem(
    TOKEN_KEY
  );
}

export function isAuthenticated() {
  return !!getToken();
}