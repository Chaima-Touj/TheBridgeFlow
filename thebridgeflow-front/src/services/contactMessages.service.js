import api from "./api.js";

export const contactMessagesService = {
  submit: (payload, config) => api.post("/contact-messages", payload, config),
};
