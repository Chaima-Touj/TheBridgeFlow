import api from "./api.js";

export const adminService = {
  getDashboardStats: () => api.get("/admin/dashboard-stats"),
  getAdvancedStats:  () => api.get("/admin/stats"),
  getOnlineCount:    () => api.get("/admin/online-count"),
  getTopOffers:      () => api.get("/admin/top-offers"),
  getTopFormations:  () => api.get("/admin/top-formations"),
  getTopPages:       () => api.get("/admin/top-pages"),

  createUser:        (data)           => api.post("/admin/users", data),
  getUsers:          ()               => api.get("/admin/users"),
  getUserById:       (id)             => api.get(`/admin/users/${id}`),
  updateUserStatus:  (id, isActive)   => api.patch(`/admin/users/${id}/status`, { isActive }),
  updateUserRole:    (id, role)       => api.patch(`/admin/users/${id}/role`, { role }),
  deleteUser:        (id)             => api.delete(`/admin/users/${id}`),
};
