import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

export async function apiRequest<T>(path: string, options?: { method?: string; data?: unknown; params?: Record<string, unknown> }) {
  const response = await api.request<T>({ url: path, method: options?.method || "GET", data: options?.data, params: options?.params });
  return response.data;
}

export const authApi = {
  signup: (payload: { name: string; email: string; password: string; mobile?: string }) => apiRequest<{ user: unknown }>("/auth/signup", { method: "POST", data: payload }),
  login: (payload: { email: string; password: string; deviceId?: string }) => apiRequest<{ accessToken: string; user: unknown }>("/auth/login", { method: "POST", data: payload }),
  refresh: () => apiRequest<{ accessToken: string }>("/auth/refresh", { method: "POST" })
};
