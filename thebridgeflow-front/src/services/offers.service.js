import api from "./api.js";

export const offersService = {
  getAll:      (params) => api.get("/offers", { params }),
  getOne:      (id)     => api.get(`/offers/${id}`),
  create:      (data)   => api.post("/offers", data),
  update:      (id, data) => api.put(`/offers/${id}`, data),
  delete:      (id)     => api.delete(`/offers/${id}`),
  getDomains:  ()        => api.get("/offers/meta/domains"),

  getAllAdmin: ()           => api.get("/offers/admin"),
  updateStatus:(id, isActive) => api.patch(`/offers/${id}/status`, { isActive }),
};
