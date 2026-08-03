import api from "./api.js";

export const aiService = {
  chat:            (messages, temperature) => api.post("/ai/chat", { messages, temperature }),
  getUserContext:  ()                      => api.get("/ai/user-context"),
  recommendations: (limit)                => api.post("/ai/recommendations", { limit }),
  analyzeCV:       (text)                 => api.post("/ai/analyze-cv", { text }),
  generateMotivation: (offerId, tone)     => api.post("/ai/generate-motivation", { offerId, tone }),
};
