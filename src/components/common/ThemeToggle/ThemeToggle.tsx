"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle(): JSX.Element {
  const { theme, setTheme, isDark } = useTheme();

  function handleToggle(): void {
    setTheme(isDark ? "light" : "dark");
  }

  const getIcon = (): React.ReactNode => {
    return isDark ? <Sun size={16} /> : <Moon size={16} />;
  };

  const getLabel = (): string => {
    return isDark ? "Switch to light mode" : "Switch to dark mode";
  };

  return (
    <button
      className="icon-btn-plain"
      onClick={handleToggle}
      aria-label={`Switch theme (current: ${getLabel()})`}
      title={`Switch theme (current: ${getLabel()})`}
      type="button"
    >
      {getIcon()}
    </button>
  );
}
