import api from "./api.js";

// Espace « Candidatures » côté admin : étudiants regroupés avec leurs
// candidatures, dossier individuel et historique de suivi partagé entre
// administrateurs. L'étudiant concerné est toujours celui de l'URL du dossier
// (`studentId`), jamais un champ saisi dans un formulaire.
const base = "/admin/candidates";

export const candidatesService = {
  getStats: (config) => api.get(`${base}/stats`, config),

  // params : { search, filter, page, limit, sort }
  list: (params, config) => api.get(base, { ...config, params }),

  getDossier: (studentId, config) => api.get(`${base}/${studentId}`, config),

  // Récupère le fichier (CV / lettre) en Blob via l'API authentifiée : le
  // jeton Bearer ne peut pas accompagner un simple <a href> ou <iframe src>.
  getDocument: (studentId, key, disposition = "inline", config) =>
    api.get(`${base}/${studentId}/document`, {
      ...config,
      params: { key, disposition },
      responseType: "blob",
    }),

  // params : { status, type, applicationId, overdue }
  getTasks: (studentId, params, config) =>
    api.get(`${base}/${studentId}/tasks`, { ...config, params }),

  createTask: (studentId, payload) => api.post(`${base}/${studentId}/tasks`, payload),

  updateTask: (studentId, taskId, payload) =>
    api.patch(`${base}/${studentId}/tasks/${taskId}`, payload),

  deleteTask: (studentId, taskId) => api.delete(`${base}/${studentId}/tasks/${taskId}`),
};
