import { createContext, useContext, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { STORAGE_KEY } from "../constants/storage";

const AuthContext = createContext(null);

function loadStoredSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadStoredSession());

  const login = async (username, password) => {
    const response = await apiClient.login(username.trim(), password);
    const nextSession = {
      token: response.token,
      role: response.role,
      userId: response.userId,
      username: response.username,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    return nextSession;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  const value = useMemo(
    () => ({
      session,
      login,
      logout,
      isAuthenticated: Boolean(session?.token),
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

