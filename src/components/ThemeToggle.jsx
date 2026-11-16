import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
  return (
    <button type="button" className={`icon-btn ${className}`} onClick={toggleTheme} aria-label={label} title={label}>
      {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
