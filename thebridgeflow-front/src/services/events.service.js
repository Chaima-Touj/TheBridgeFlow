import api from "./api.js";

export const eventsService = {
  getPublic: (period) => api.get("/events", { params: period ? { period } : undefined }),
  getOne: (id) => api.get(`/events/${id}`),
  getAdmin: () => api.get("/events/admin"),
  create: (event) => api.post("/events", event),
  update: (id, event) => api.patch(`/events/${id}`, event),
  getRegistrations: (id) => api.get(`/events/${id}/registrations`),
  register: (id) => api.post(`/events/${id}/registrations`),
  getMyRegistrations: () => api.get("/events/my-registrations"),
  cancelRegistration: (id) => api.delete(`/events/${id}/registrations`),
};
