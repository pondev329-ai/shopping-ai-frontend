import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'standard' | 'large' | 'extra_large';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('shopping_ai_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // LocalStorage might be restricted
    }
    return 'system';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    try {
      const saved = localStorage.getItem('shopping_ai_font_size');
      if (saved === 'small' || saved === 'standard' || saved === 'large' || saved === 'extra_large') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'standard';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('shopping_ai_theme');
      if (saved === 'dark') return 'dark';
      if (saved === 'light') return 'light';
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (currentTheme: ThemeMode) => {
      let isDark = false;
      if (currentTheme === 'dark') {
        isDark = true;
      } else if (currentTheme === 'light') {
        isDark = false;
      } else {
        isDark = mediaQuery.matches;
      }

      setResolvedTheme(isDark ? 'dark' : 'light');

      const root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme(theme);

    const handleMediaChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, [theme]);

  // フォントサイズのHTMLルート適用
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('text-size-small', 'text-size-standard', 'text-size-large', 'text-size-extra-large');
    root.classList.add(`text-size-${fontSize.replace('_', '-')}`);
  }, [fontSize]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('shopping_ai_theme', newTheme);
    } catch {
      // ignore
    }
  };

  const setFontSize = (newSize: FontSize) => {
    setFontSizeState(newSize);
    try {
      localStorage.setItem('shopping_ai_font_size', newSize);
    } catch {
      // ignore
    }
  };

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setTheme,
    fontSize,
    setFontSize,
  };
}
