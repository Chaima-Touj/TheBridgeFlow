import api from "./api.js";

export const newsletterService = {
  subscribe: (email, language) => api.post("/newsletter/subscribe", { email, language }),
  unsubscribe: (token, language) => api.post(`/newsletter/unsubscribe/${encodeURIComponent(token)}`, { language }),
  getSubscribers: (params) => api.get("/newsletter/admin/subscribers", { params }),
};
