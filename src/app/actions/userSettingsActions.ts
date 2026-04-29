/**
 * User Settings Actions.
 */

import { eventBus } from '@cyberfabric/react';
import type { UserSettings } from '@/app/api';

export function loadUserSettings(): void {
  eventBus.emit('user/settings/load');
}

export function updateUserSettings(patch: Partial<UserSettings>): void {
  eventBus.emit('user/settings/update', { patch });
}
