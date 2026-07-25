"use client";

import { useEffect, useState } from "react";

type ThemePref = "light" | "dark" | "auto";

const STORAGE_KEY = "biasly-theme";

function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "auto") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(pref: ThemePref) {
  document.documentElement.setAttribute("data-theme", resolveTheme(pref));
}

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => {
    if (typeof window === "undefined") return "auto";
    return (localStorage.getItem(STORAGE_KEY) as ThemePref | null) ?? "auto";
  });

  useEffect(() => {
    if (pref !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("auto");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [pref]);

  function choose(next: ThemePref) {
    setPref(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  const options: { value: ThemePref; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "auto", label: "Auto" },
  ];

  return (
    <span className="theme-toggle" role="group" aria-label="Theme">
      <span>Theme:</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={pref === option.value ? "theme-option active" : "theme-option"}
          aria-pressed={pref === option.value}
          onClick={() => choose(option.value)}
          suppressHydrationWarning
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}
