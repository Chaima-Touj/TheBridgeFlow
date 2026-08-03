import api from "./api.js";

export const newsService = {
  getAll:  (limit)  => api.get(limit ? `/news?limit=${limit}` : "/news"),
  getOne:  (id)     => api.get(`/news/${id}`),

  createNews: (formData)     => api.post("/news", formData),
  updateNews: (id, formData) => api.put(`/news/${id}`, formData),
  deleteNews: (id)           => api.delete(`/news/${id}`),
};
