import { useCallback, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'krentprocent_theme_v1';

export type ThemeMode = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    const themeColorMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const nextColor = theme === 'dark' ? '#18181B' : '#FFFFFF';
    if (themeColorMetas.length > 0) {
      themeColorMetas[0].removeAttribute('media');
      themeColorMetas[0].setAttribute('content', nextColor);
      themeColorMetas.slice(1).forEach((m) => {
        m.remove();
      });
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
