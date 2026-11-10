import api from "./api.js";

export const newsletterService = {
  subscribe: (email, language, config) => api.post("/newsletter/subscribe", { email, language }, config),
  unsubscribe: (token, language) => api.post(`/newsletter/unsubscribe/${encodeURIComponent(token)}`, { language }),
  getSubscribers: (params) => api.get("/newsletter/admin/subscribers", { params }),
};
