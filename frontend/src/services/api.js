import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("bugmind_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      window.dispatchEvent(new CustomEvent('network-offline'));
    } else if (error.response?.status === 401) {
      localStorage.removeItem("bugmind_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;