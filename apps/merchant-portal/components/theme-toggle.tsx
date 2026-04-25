"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "sm_theme_mode";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as "light" | "dark" | null) ?? "light";
    setTheme(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [mounted, theme]);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button className="chip" type="button" onClick={toggle}>
      {mounted ? (theme === "light" ? "Dark mode" : "Light mode") : "Theme"}
    </button>
  );
}
