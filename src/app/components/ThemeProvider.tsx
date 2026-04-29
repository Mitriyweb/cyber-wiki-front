/**
 * ThemeProvider — keeps Tailwind's `dark` class in sync with the active
 * cyberfabric theme.
 *
 * Cyberfabric's `useTheme()` already drives CSS-variable-based theming
 * (colors via `hsl(var(--primary))` etc.), but our Tailwind config uses
 * `darkMode: ['class']` so any `dark:` utility (`dark:bg-...`,
 * `dark:text-...`) needs an explicit `.dark` class on `<html>`.
 *
 * This component reads the current theme id and toggles that class.
 * No state of its own — purely a side-effect bridge.
 */

import { useEffect } from 'react';
import { useTheme } from '@cyberfabric/react';

const DARK_THEME_IDS: ReadonlySet<string> = new Set(['dark', 'dracula', 'dracula-large']);

export function ThemeProvider() {
  const { currentTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const isDark = !!currentTheme && DARK_THEME_IDS.has(currentTheme);
    root.classList.toggle('dark', isDark);
    root.dataset.theme = currentTheme ?? '';
  }, [currentTheme]);

  return null;
}
