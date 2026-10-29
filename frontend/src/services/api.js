import axios from "axios";
import { supabase } from "./supabase.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/",
  timeout: 0,
});

// Interceptor untuk menyisipkan Supabase JWT token pada setiap request ke API backend
api.interceptors.request.use(async (config) => {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn("Gagal menyisipkan auth token:", err);
    }
  }
  return config;
});

export async function getHealth() {
  const { data } = await api.get("/api/health");
  return data;
}

export async function predictCxr(file) {
  const form = new FormData();
  form.append("image", file);

  const { data } = await api.post("/api/predict", form);
  return data;
}

export async function interpretCxr(id) {
  const { data } = await api.post("/api/interpret", { id });
  return data;
}

export async function fetchApiHistory() {
  const { data } = await api.get("/api/history");
  return data.items || [];
}

export async function saveApiHistory(entry) {
  const { data } = await api.post("/api/history", entry);
  return data;
}

export async function sendChatMessage({
  prediction_id,
  message,
  history = [],
  context = {},
}) {
  const { data } = await api.post("/api/chat", {
    prediction_id,
    message,
    history,
    context,
  });
  return data;
}

export default api;