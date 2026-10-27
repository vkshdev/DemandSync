'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Read initial theme set by the FOUC prevention script
    const isDark = document.documentElement.classList.contains('dark');
    setThemeState(isDark ? 'dark' : 'light');

    // Handle cross-tab sync via storage event (as recommended in dark-mode-toggle guide)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    startTransition(() => {
      setThemeState(newTheme);
      try {
        localStorage.setItem('theme', newTheme);
      } catch {}

      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Update <meta name="color-scheme">
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        meta.setAttribute('content', newTheme);
      }
    });
  };

  const toggleTheme = () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (newTheme: Theme) => {
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
