import { jsonpRequest } from "./jsonp";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function callRoute(route, payload = {}) {
  const response = await jsonpRequest(API_BASE_URL, {
    route,
    payload: JSON.stringify(payload),
  });

  if (!response?.ok) {
    throw new Error(response?.message || "Request failed");
  }

  return response;
}

export const apiClient = {
  login: (username, password) =>
    callRoute("login", {
      username,
      password,
    }),

  createUser: (adminToken, data) =>
    callRoute("createUser", {
      adminToken,
      ...data,
    }),

  listUsers: (token) =>
    callRoute("listUsers", {
      token,
    }),

  createProject: (token, data) =>
    callRoute("createProject", {
      token,
      ...data,
    }),

  getMyProjects: (token) =>
    callRoute("getMyProjects", {
      token,
    }),

  getAllProjects: (token) =>
    callRoute("getAllProjects", {
      token,
    }),

  addProjectUpdate: (token, projectId, remark) =>
    callRoute("addProjectUpdate", {
      token,
      projectId,
      remark,
    }),

  getProjectUpdates: (token, projectId) =>
    callRoute("getProjectUpdates", {
      token,
      projectId,
    }),
};

