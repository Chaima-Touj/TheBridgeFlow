import api from "./api.js";

// Demandes de participation aux événements (formulaire des pages Contact).
export const eventParticipationService = {
  submit: (payload, config) => api.post("/event-participation-requests", payload, config),
  // params : { search, status, event, page, limit }
  list: (params, config) => api.get("/event-participation-requests", { ...config, params }),
  getOne: (id) => api.get(`/event-participation-requests/${id}`),
  updateStatus: (id, status) => api.patch(`/event-participation-requests/${id}/status`, { status }),
};
