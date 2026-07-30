import api from "./api.js";

export const settingsService = {
  get:    ()     => api.get("/settings"),
  update: (data) => api.patch("/settings", data),
};
