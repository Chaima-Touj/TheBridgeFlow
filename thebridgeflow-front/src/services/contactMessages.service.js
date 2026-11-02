import api from "./api.js";

export const contactMessagesService = {
  submit: (payload) => api.post("/contact-messages", payload),
  getAll: () => api.get("/contact-messages"),
  markRead: (id) => api.patch(`/contact-messages/${id}/read`),
};
