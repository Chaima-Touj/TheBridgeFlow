import api from "./api.js";

export const localizeOffer = (offer, language = "fr") => {
  if (!offer) return offer;
  const translated = offer.translations?.[String(language).split("-")[0]];
  return {
    ...offer,
    title: translated?.title || offer.title,
    description: translated?.description || offer.description,
    domain: translated?.domain || offer.domain,
    location: translated?.location || offer.location,
    duration: translated?.duration || offer.duration,
    skills: translated?.skills?.length ? translated.skills : offer.skills,
  };
};

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
