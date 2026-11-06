import api from "./api.js";

export const eventsService = {
  getPublic: (period) => api.get("/events", { params: period ? { period } : undefined }),
  getOne: (id) => api.get(`/events/${id}`),
  getSessionLink: (id) => api.get(`/events/${id}/session-link`),
  getAdmin: () => api.get("/events/admin"),
  create: (event) => api.post("/events", event),
  update: (id, event) => api.patch(`/events/${id}`, event),
  deleteEvent: (id) => api.delete(`/events/${id}`),
  getRegistrations: (id) => api.get(`/events/${id}/registrations`),
  register: (id) => api.post(`/events/${id}/registrations`),
  getMyRegistrations: () => api.get("/events/my-registrations"),
  cancelRegistration: (id) => api.delete(`/events/${id}/registrations`),
  getPublishedFeedbacks: (id) => api.get(`/events/${id}/feedbacks`),
  getMyFeedback: (id) => api.get(`/events/${id}/my-feedback`),
  submitFeedback: (id, feedback) => api.post(`/events/${id}/feedbacks`, feedback),
  getAdminFeedbacks: () => api.get("/events/feedbacks/admin"),
  setFeedbackPublished: (feedbackId, isPublished) => api.patch(
    `/events/feedbacks/${feedbackId}/publication`,
    { isPublished },
  ),
};
