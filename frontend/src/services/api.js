import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/",
  timeout: 180000,
});

export async function getHealth() {
  const { data } = await api.get("/api/health");
  return data;
}

export async function predictCxr(file) {
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post("/api/predict", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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

export default api;
