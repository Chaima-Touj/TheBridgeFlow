import api from "./api.js";

export const ceremonyService = {
  getProjects:    ()            => api.get("/ceremony/projects"),
  getProject:     (id)          => api.get(`/ceremony/projects/${id}`),
  getMyProjects:  ()            => api.get("/ceremony/my-projects"),
  createProject:  (data)        => api.post("/ceremony/projects", data),
  vote:           (projectIds)  => api.post("/ceremony/vote", { projectIds }),
  getLeaderboard: ()            => api.get("/ceremony/leaderboard"),
  getSettings:    ()            => api.get("/ceremony/settings"),
  getStats:       ()            => api.get("/ceremony/stats"),

  // ── Admin ─────────────────────────────────────────────────────────────────
  getAdminProjects:    ()          => api.get("/ceremony/admin/projects"),
  acceptProject:       (id)        => api.patch(`/ceremony/admin/projects/${id}/accept`),
  rejectProject:       (id)        => api.patch(`/ceremony/admin/projects/${id}/reject`),
  updateSettings:      (data)      => api.patch("/ceremony/admin/settings", data),
  closeAndAnnounce:    ()          => api.post("/ceremony/admin/close-and-announce"),
  resetVotes:          ()          => api.post("/ceremony/admin/reset-votes"),
};
