import api from "./api.js";

export const ceremonyService = {
  getProjects:    ()            => api.get("/ceremony/projects"),
  getProject:     (id)          => api.get(`/ceremony/projects/${id}`),
  getMyProjects:  ()            => api.get("/ceremony/my-projects"),
  createProject:  (data)        => api.post("/ceremony/projects", data),
  vote:           (projectIds)  => api.post("/ceremony/vote", { projectIds }),
  getLeaderboard: ()            => api.get("/ceremony/leaderboard"),
};
