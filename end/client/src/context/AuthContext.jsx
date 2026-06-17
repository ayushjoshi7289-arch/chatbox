// client/src/context/AuthContext.jsx

import React, { useEffect, useState } from "react";
import api from "../api";
import AuthContextInternal from "./AuthContextInternal";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    const res = await api.get("/api/auth/me", {
      withCredentials: true,
    });

    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
    } else {
      setUser(null);
    }
  };

  // Fetch current user from backend on app load
  useEffect(() => {
    fetchMe()
      .catch((err) => {
        console.error("Auth check failed", err);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Login
  const login = async (form) => {
    const res = await api.post(
      "/api/auth/login",
      form,
      { withCredentials: true }
    );

    if (res.data?.success) {
      setUser(res.data.user || null);
    } else {
      throw new Error(res.data?.message || "Login failed");
    }
  };

  // Signup
  const signup = async (form) => {
    const res = await api.post(
      "/api/auth/signup",
      form,
      { withCredentials: true }
    );

    if (res.data?.success) {
      setUser(res.data.user || null);
    } else {
      throw new Error(res.data?.message || "Signup failed");
    }
  };

  // Logout
  const logout = async () => {
    try {
      await api.post(
        "/api/auth/logout",
        {},
        { withCredentials: true }
      );

      setUser(null);
      localStorage.removeItem("user");
    } catch (err) {
      console.error("Logout error", err);

      setUser(null);
      localStorage.removeItem("user");
    }
  };

  const updateProfile = async (payload) => {
    const res = await api.post(
      "/api/profile",
      payload,
      { withCredentials: true }
    );

    if (res.data?.success) {
      await fetchMe();
    }
  };

  return (
    <AuthContextInternal.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContextInternal.Provider>
  );
}