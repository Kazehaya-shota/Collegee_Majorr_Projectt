'use client';

import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

const storageKey = 'varen-theme';

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('varen-theme-change', onStoreChange);
      return () => window.removeEventListener('varen-theme-change', onStoreChange);
    },
    () => window.localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light',
    () => 'light',
  );

  function toggleTheme() {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new Event('varen-theme-change'));
  }

  const isDark = theme === 'dark';

  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-pressed={isDark} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}><span aria-hidden="true">{isDark ? '☀' : '☾'}</span></button>;
}
