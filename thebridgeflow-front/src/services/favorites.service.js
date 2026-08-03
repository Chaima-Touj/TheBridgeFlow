import api from "./api.js";

export const favoritesService = {
  getAll: ()        => api.get("/favorites"),
  toggle: (offerId) => api.post(`/favorites/${offerId}`),
};
