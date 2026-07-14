"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BRAND_STORAGE_KEY,
  DEFAULT_BRAND,
  applyBrandTokens,
  buildBrandTokens,
  normalizeHex,
} from "@/lib/brand-palette";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  brandColor: string;
  setBrandColor: (hex: string) => void;
  resetBrandColor: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function applyBrand(hex: string, theme: Theme) {
  const normalized = normalizeHex(hex) || DEFAULT_BRAND;
  applyBrandTokens(buildBrandTokens(normalized, theme));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [brandColor, setBrandColorState] = useState(DEFAULT_BRAND);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem("catetrek_theme") as Theme | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = storedTheme || (prefersDark ? "dark" : "light");
    const storedBrand = normalizeHex(localStorage.getItem(BRAND_STORAGE_KEY) || "") || DEFAULT_BRAND;

    setThemeState(nextTheme);
    setBrandColorState(storedBrand);
    applyTheme(nextTheme);
    applyBrand(storedBrand, nextTheme);
    setReady(true);
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      localStorage.setItem("catetrek_theme", next);
      applyTheme(next);
      applyBrand(brandColor, next);
    },
    [brandColor]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const setBrandColor = useCallback(
    (hex: string) => {
      const next = normalizeHex(hex) || DEFAULT_BRAND;
      setBrandColorState(next);
      localStorage.setItem(BRAND_STORAGE_KEY, next);
      applyBrand(next, theme);
    },
    [theme]
  );

  const resetBrandColor = useCallback(() => {
    setBrandColor(DEFAULT_BRAND);
  }, [setBrandColor]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      brandColor,
      setBrandColor,
      resetBrandColor,
    }),
    [theme, setTheme, toggleTheme, brandColor, setBrandColor, resetBrandColor]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className={ready ? "opacity-100" : "opacity-0"} style={{ transition: "opacity 0.2s ease" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
