/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HAI3Provider } from '@cyberfabric/react';
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

// Register a minimal translation loader so language switching triggers re-renders.
// Without at least one loader, i18nRegistry.setLanguage() never calls notifySubscribers().
app.i18nRegistry.registerLoader('app', async () => ({}));

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
