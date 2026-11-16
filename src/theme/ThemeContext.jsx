import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "unimak-theme";
const ThemeContext = createContext(null);

const systemTheme = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function readInitial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return { theme: saved, explicit: true };
  } catch {}
  return { theme: systemTheme(), explicit: false };
}

export function ThemeProvider({ children }) {
  const [state, setState] = useState(readInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  // Follow the device setting until the user picks a theme themselves.
  useEffect(() => {
    if (state.explicit || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setState({ theme: systemTheme(), explicit: false });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [state.explicit]);

  const setTheme = useCallback((theme) => {
    try { localStorage.setItem(KEY, theme); } catch {}
    setState({ theme, explicit: true });
  }, []);

  const useDeviceTheme = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch {}
    setState({ theme: systemTheme(), explicit: false });
  }, []);

  const value = useMemo(
    () => ({
      theme: state.theme,
      followsDevice: !state.explicit,
      setTheme,
      useDeviceTheme,
      toggleTheme: () => setTheme(state.theme === "dark" ? "light" : "dark"),
    }),
    [state, setTheme, useDeviceTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
