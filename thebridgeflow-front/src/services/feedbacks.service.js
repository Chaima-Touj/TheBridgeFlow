import api from "./api.js";

// Centralise les appels aux 3 sous-API de la page AdminFeedbacks :
// avis de formation (Formation.reviews[]), témoignages vidéo (SiteSettings.
// testimonialVideos[]) et captures d'écran de témoignages (TestimonialScreenshot).
export const feedbacksService = {
  // ── Avis de formation ────────────────────────────────────────────────
  addReview:    (formationId, data)           => api.post(`/formations/${formationId}/reviews`, data),
  updateReview: (formationId, reviewId, data) => api.patch(`/formations/${formationId}/reviews/${reviewId}`, data),
  deleteReview: (formationId, reviewId)       => api.delete(`/formations/${formationId}/reviews/${reviewId}`),

  // ── Témoignages vidéo (Summer Camp / PFE / Formation) ────────────────
  addTestimonialVideo:    (data)     => api.post("/settings/testimonials", data),
  updateTestimonialVideo: (id, data) => api.patch(`/settings/testimonials/${id}`, data),
  deleteTestimonialVideo: (id)       => api.delete(`/settings/testimonials/${id}`),

  // ── Captures d'écran de témoignages ──────────────────────────────────
  getScreenshots:    ()     => api.get("/testimonial-screenshots"),
  addScreenshot:     (data)     => api.post("/testimonial-screenshots", data),
  updateScreenshot:  (id, data) => api.patch(`/testimonial-screenshots/${id}`, data),
  deleteScreenshot:  (id)       => api.delete(`/testimonial-screenshots/${id}`),
};
