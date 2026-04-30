/**
 * useMonacoTheme — keeps Monaco's `theme` prop in sync with the app's
 * `<html data-theme>` attribute, which `ThemeProvider` flips between
 * "light" and "dark". Shared by every Monaco-backed primitive
 * (CodeEditor / CodeViewer / CodeDiffViewer) so theme switching is one
 * source of truth.
 */

import { useEffect, useState } from 'react';

export enum MonacoTheme {
  Light = 'vs',
  Dark = 'vs-dark',
}

const THEME_ATTR = 'data-theme';

function read(): MonacoTheme {
  return document.documentElement.getAttribute(THEME_ATTR) === 'dark'
    ? MonacoTheme.Dark
    : MonacoTheme.Light;
}

export function useMonacoTheme(): MonacoTheme {
  const [theme, setTheme] = useState<MonacoTheme>(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [THEME_ATTR],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}
