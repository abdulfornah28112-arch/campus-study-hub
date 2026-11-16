import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

const LibraryContext = createContext(null);

export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const storageKey = user?.isDevPreview ? `unimak-library-${user.id}` : null;
  const [ids, setIds] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    if (!user) {
      setIds([]);
      return undefined;
    }
    if (user.isDevPreview) {
      try { setIds(JSON.parse(localStorage.getItem(storageKey)) || []); }
      catch { setIds([]); }
      return undefined;
    }
    apiRequest("/api/bookmarks")
      .then((resources) => { if (active) setIds(resources.map((resource) => resource.id)); })
      .catch(() => {
        if (active) setError("Your saved resources could not be loaded from the backend.");
      });
    return () => { active = false; };
  }, [user, storageKey]);

  const toggle = useCallback(async (id) => {
    setError("");
    if (user?.isDevPreview) {
      const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); }
      catch { setError("This browser could not save the preview library."); }
      setIds(next);
      return;
    }
    if (!user) return;
    const removing = ids.includes(id);
    try {
      await apiRequest(`/api/bookmarks/${id}`, { method: removing ? "DELETE" : "POST" });
      setIds((previous) => removing ? previous.filter((item) => item !== id) : [...previous, id]);
    } catch (requestError) {
      setError(requestError.message || "The library change could not be saved.");
    }
  }, [user, ids, storageKey]);

  const value = useMemo(() => ({ ids, toggle, error, isSaved: (id) => ids.includes(id) }), [ids, toggle, error]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export const useLibrary = () => useContext(LibraryContext);
