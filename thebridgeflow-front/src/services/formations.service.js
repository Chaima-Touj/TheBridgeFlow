import api from "./api.js";

export const formationsService = {
  getAll:      ()     => api.get("/formations"),
  getOne:      (id)   => api.get(`/formations/${id}`),
  getBySlug:   (slug) => api.get(`/formations/slug/${slug}`),
  getTechMap:  ()     => api.get("/formations/tech-map"),

  createFormation: (data)     => api.post("/formations", data),
  updateFormation: (id, data) => api.patch(`/formations/${id}`, data),
  deleteFormation: (id)       => api.delete(`/formations/${id}`),

  // ── Video management ─────────────────────────────────────────────────
  updateTrailer: (id, data) => api.patch(`/formations/${id}/trailer`, data),

  updateVideos:    (slug, videos) => api.patch(`/formations/slug/${slug}/videos`, { videos }),
  updateWeeks:     (slug, weeks)  => api.patch(`/formations/slug/${slug}/weeks`, { weeks }),
  updateSupervision: (slug, supervision) => api.patch(`/formations/slug/${slug}/supervision`, { supervision }),

  uploadVideoThumbnail: (file) => {
    const fd = new FormData();
    fd.append("thumbnail", file);
    return api.post("/formations/upload-thumbnail", fd);
  },
};
