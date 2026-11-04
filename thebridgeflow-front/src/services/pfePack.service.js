import api from "./api.js";

export const pfePackService = {
  register: (data) => api.post("/pfe-pack/registrations", data),
  getRegistrations: () => api.get("/pfe-pack/registrations"),
  getRegistration: (id) => api.get(`/pfe-pack/registrations/${id}`),
};
