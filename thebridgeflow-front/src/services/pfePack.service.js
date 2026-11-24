import api from "./api.js";

export const pfePackService = {
  register: (data, config) => api.post("/pfe-pack/registrations", data, config),
  getRegistrations: () => api.get("/pfe-pack/registrations"),
  getRegistration: (id) => api.get(`/pfe-pack/registrations/${id}`),
  // Suivi par l'équipe : "new" | "contacted" | "confirmed" (admin uniquement).
  updateStatus: (id, status) => api.patch(`/pfe-pack/registrations/${id}/status`, { status }),
};
