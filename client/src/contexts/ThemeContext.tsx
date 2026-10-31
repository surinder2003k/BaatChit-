import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
interface ThemeContextType { theme: Theme; toggleTheme: () => void; switchable: boolean; }
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children, switchable = true }: { children: React.ReactNode; defaultTheme?: Theme; switchable?: boolean }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    return (stored as Theme) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); localStorage.setItem("theme", theme); }, [theme]);
  return <ThemeContext.Provider value={{ theme, switchable, toggleTheme: () => setTheme(t => t === "light" ? "dark" : "light") }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const context = useContext(ThemeContext); if (!context) throw new Error("useTheme must be used within ThemeProvider"); return context; }
