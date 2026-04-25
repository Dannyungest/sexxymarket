"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_KEY = "sm_theme_mode";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => {
    const next: ThemeMode = theme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  };

  return (
    <button type="button" className="chip" onClick={toggle} suppressHydrationWarning>
      {theme === "light" ? "Dark mode" : "Light mode"}
    </button>
  );
}
