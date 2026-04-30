/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HAI3Provider, Language } from '@cyberfabric/react';
import { Toaster } from 'sonner';
import './globals.css'; // Global styles with CSS variables
import App from './App';
import { app } from './initApp';

// Import all themes
import { DEFAULT_THEME_ID, defaultTheme } from '@/app/themes/default';
import { darkTheme } from '@/app/themes/dark';
import { lightTheme } from '@/app/themes/light';

// Register all themes (default theme has default:true, activates automatically)
app.themeRegistry.register(defaultTheme);
app.themeRegistry.register(lightTheme);
app.themeRegistry.register(darkTheme);

// Apply default theme explicitly
app.themeRegistry.apply(DEFAULT_THEME_ID);

// Register the app's translation loader. Returns the dictionary for the
// requested language, falling back to English. Add a locale by creating
// `src/app/locales/<code>.json` and extending the switch below.
//
// IMPORTANT: the framework's i18n plugin already called
// `i18nRegistry.setLanguage(English)` inside `createHAI3App(...)` (during
// `initApp.ts`), at a moment when no loaders were registered yet, so the
// initial pass produced an empty dictionary. We therefore re-trigger
// `setLanguage` *after* registering the loader so the dictionary actually
// gets populated. Without this, every `t('key')` returns the literal key.
app.i18nRegistry.registerLoader('app', async (language) => {
  switch (language) {
    case 'en':
    default: {
      const mod = await import('@/app/locales/en.json');
      return mod.default;
    }
  }
});

void app.i18nRegistry.setLanguage(Language.English);

/**
 * Render application
 * Bootstrap happens automatically when Layout mounts
 *
 * Flow:
 * 1. App renders → Layout mounts → bootstrap dispatched
 * 2. Components show skeleton loaders (translationsReady = false)
 * 3. User fetched → language set → translations loaded
 * 4. Components re-render with actual text (translationsReady = true)
 * 5. Enrichment panel renders inline (no MFE)
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HAI3Provider app={app}>
      <App />
      <Toaster />
    </HAI3Provider>
  </StrictMode>
);
