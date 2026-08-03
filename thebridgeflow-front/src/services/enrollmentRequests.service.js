import api from "./api.js";

export const enrollmentRequestsService = {
  create:   (formationId, mode, message) =>
    api.post("/enrollment-requests", { formationId, mode, message }),
  getAll:   () => api.get("/enrollment-requests"),

  // ── Admin ─────────────────────────────────────────────────────────────────
  getAllAdmin: (status) =>
    api.get("/enrollment-requests/admin", { params: status && status !== "all" ? { status } : undefined }),
  accept: (id) => api.patch(`/enrollment-requests/${id}/accept`),
  reject: (id) => api.patch(`/enrollment-requests/${id}/reject`),
};
