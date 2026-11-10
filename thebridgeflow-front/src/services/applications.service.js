import api from "./api.js";

export const applicationsService = {
  // Créer une candidature
  create: (data, config) => api.post("/applications", data, config),

  // Récupérer toutes mes candidatures
  getAll: () => api.get("/applications"),

  // Récupérer une candidature par ID
  getById: (id) => api.get(`/applications/${id}`),

  // Mettre à jour le statut (entreprise)
  updateStatus: (id, status) => api.put(`/applications/${id}/status`, { status }),
};