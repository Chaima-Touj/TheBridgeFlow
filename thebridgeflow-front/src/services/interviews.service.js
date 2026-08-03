import api from "./api.js";

export const interviewsService = {
  getAll:       ()             => api.get("/interviews"),
  propose:      (data)         => api.post("/interviews", data),
  updateStatus: (id, status)   => api.put(`/interviews/${id}/status`, { status }),
};
