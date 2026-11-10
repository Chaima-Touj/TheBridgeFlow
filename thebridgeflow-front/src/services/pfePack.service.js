import api from "./api.js";

export const pfePackService = {
  register: (data, config) => api.post("/pfe-pack/registrations", data, config),
  getRegistrations: () => api.get("/pfe-pack/registrations"),
  getRegistration: (id) => api.get(`/pfe-pack/registrations/${id}`),
};
