/**
 * User Settings Effects — localStorage persistence.
 *
 * Owns the in-memory copy of user settings; reads/writes localStorage on the
 * `user/settings/load|update` events; emits `user/settings/loaded|updated`.
 */

import { eventBus } from '@cyberfabric/react';
import { DEFAULT_USER_SETTINGS, type UserSettings } from '@/app/api';

const STORAGE_KEY = 'cyberwiki:userSettings';

function readFromStorage(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_USER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      ...DEFAULT_USER_SETTINGS,
      ...parsed,
      spaceViewModes: { ...DEFAULT_USER_SETTINGS.spaceViewModes, ...(parsed.spaceViewModes ?? {}) },
      lastOpenedPath: { ...DEFAULT_USER_SETTINGS.lastOpenedPath, ...(parsed.lastOpenedPath ?? {}) },
    };
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

function writeToStorage(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage quota exceeded or disabled — silently ignore; the in-memory
    // copy still flows via events.
  }
}

export function registerUserSettingsEffects(): void {
  let current: UserSettings = readFromStorage();

  eventBus.on('user/settings/load', () => {
    current = readFromStorage();
    eventBus.emit('user/settings/loaded', { settings: current });
  });

  eventBus.on('user/settings/update', ({ patch }) => {
    current = {
      ...current,
      ...patch,
      spaceViewModes: { ...current.spaceViewModes, ...(patch.spaceViewModes ?? {}) },
      lastOpenedPath: { ...current.lastOpenedPath, ...(patch.lastOpenedPath ?? {}) },
    };
    writeToStorage(current);
    eventBus.emit('user/settings/updated', { settings: current });
  });
}
