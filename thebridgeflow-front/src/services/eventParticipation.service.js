import api from "./api.js";

// Dashboard Admin → Messages du site : messages du formulaire de contact et
// demandes de participation aux événements (envoi public : contactMessages.service.js).
export const eventParticipationService = {
  // params : { search, status, event, page, limit }
  list: (params, config) => api.get("/event-participation-requests", { ...config, params }),
  getOne: (id) => api.get(`/event-participation-requests/${id}`),
  updateStatus: (id, status) => api.patch(`/event-participation-requests/${id}/status`, { status }),
};
