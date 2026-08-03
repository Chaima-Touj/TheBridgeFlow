import api from "./api";

export const profileService = {
  getMyProfile:   ()       => api.get("/auth/me"),
  updateProfile:  (data)   => api.put("/auth/profile", data),
  uploadCV: (formData)     => api.post("/auth/profile/cv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }),
  changePassword: (data)   => api.put("/auth/password", data),
  updateSettings: (data)   => api.put("/auth/settings", data),
  deleteAccount:  (data)   => api.delete("/auth/account", { data }),
};