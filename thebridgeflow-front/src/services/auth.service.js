import api from "./api.js";

export const authService = {
  register: (data) => api.post("/auth/register", data),
  login:    (data) => api.post("/auth/login", data),
  getMe:    ()     => api.get("/auth/me"),
  logout:   ()     => api.post("/auth/logout"),
};
