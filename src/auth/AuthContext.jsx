import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";

const AuthContext = createContext(null);

function mapUser(user) {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    studentId: user.studentId || "",
    department: user.department || "",
    level: user.academicLevel || "",
    role: user.role.toLowerCase(),
    canUpload: true,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const expireSession = () => {
      setUser(null);
      setAuthError("");
    };
    window.addEventListener("unimak-auth-expired", expireSession);
    return () => window.removeEventListener("unimak-auth-expired", expireSession);
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest("/api/auth/me")
      .then((profile) => { if (active) setUser(mapUser(profile)); })
      .catch((error) => {
        if (!active) return;
        if (error.status !== 401) setAuthError("Could not restore your sign-in session. Check that the backend is available.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async ({ identifier, password }) => {
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: identifier.trim(), password }),
    });
    const next = mapUser(result);
    setUser(next);
    setAuthError("");
    return next;
  }, []);

  const signUp = useCallback(async (details) => apiRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: details.name,
      studentId: details.studentId,
      email: details.email,
      password: details.password,
      department: details.department,
      academicLevel: details.level,
    }),
  }), []);

  const updateProfile = useCallback(async (changes) => {
    const profile = await apiRequest("/api/auth/me", {
      method: "PUT",
      body: JSON.stringify({
        fullName: changes.name,
        studentId: changes.studentId,
        department: changes.department,
        academicLevel: changes.level,
      }),
    });
    setUser(mapUser(profile));
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await apiRequest("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setAuthError("");
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, authError, signIn, signUp, signOut, updateProfile, changePassword }),
    [user, loading, authError, signIn, signUp, signOut, updateProfile, changePassword]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
