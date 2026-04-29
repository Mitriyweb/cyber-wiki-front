/**
 * User Settings Events — UI-only state persisted in localStorage.
 *
 * FrontX-style equivalent of doclab UserSettingsContext: events flow,
 * effect handles persistence, components subscribe to `user/settings/loaded`
 * for initial value and `user/settings/updated` for live updates.
 */

import '@cyberfabric/react';
import type { UserSettings } from '@/app/api';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Triggers initial load from localStorage. */
    'user/settings/load': void;
    /** Settings ready (or defaults if empty). */
    'user/settings/loaded': { settings: UserSettings };

    /** Patch settings — only the supplied keys change. */
    'user/settings/update': { patch: Partial<UserSettings> };
    /** Settings updated. */
    'user/settings/updated': { settings: UserSettings };
  }
}
