import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",//"http://10.237.224.218:3000",
  withCredentials: true,
});

export default api;
