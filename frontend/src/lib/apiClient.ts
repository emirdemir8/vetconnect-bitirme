import axios from "axios";

// Geliştirmede Vite proxy kullan: istekler aynı porta gider, Vite backend'e (8000) yönlendirir
const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ??
  (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV ? "" : "http://127.0.0.1:8000");

/** API base URL used by the frontend (e.g. for error messages) */
export function getApiBaseUrl(): string {
  return API_BASE_URL || "http://127.0.0.1:8000 (Vite proxy)";
}

const TOKEN_KEY = "vet_app_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      const isLoginRequest = err?.config?.url?.includes("/auth/login");
      if (!isLoginRequest) {
        clearToken();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login"))
          window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

