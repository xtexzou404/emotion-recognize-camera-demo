import apiClient from "./apiClient";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export const loginRequest = async ({ email, password }) => {
  const { data } = await apiClient.post("/auth/login", { email, password });
  return data;
};

export const meRequest = async (token) => {
  const { data } = await apiClient.get("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const saveAuth = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getSavedUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveUserProfile = (profile) => {
  const current = getSavedUser() || {};
  const next = {
    ...current,
    ...(profile || {}),
  };
  localStorage.setItem(USER_KEY, JSON.stringify(next));
  return next;
};

export const isAuthenticated = () => Boolean(getToken());
