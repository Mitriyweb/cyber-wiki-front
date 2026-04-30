/**
 * Profile Actions
 * Actions for profile domain (service tokens).
 * Following flux architecture: Actions emit events, Effects listen and dispatch.
 */

import { eventBus } from '@cyberfabric/react';
import type { ServiceTokenCreate, CacheSettings } from '@/app/api/wikiTypes';

export function loadServiceTokens(): void {
  eventBus.emit('profile/tokens/load');
}

export function saveServiceToken(data: ServiceTokenCreate): void {
  eventBus.emit('profile/tokens/save', { data });
}

export function deleteServiceToken(id: string): void {
  eventBus.emit('profile/tokens/delete', { id });
}

export function validateServiceToken(id: string): void {
  eventBus.emit('profile/tokens/validate', { id });
}

export function validateAllServiceTokens(): void {
  eventBus.emit('profile/tokens/validate-all');
}

export function loadCacheSettings(): void {
  eventBus.emit('profile/cache/load');
}

export function updateCacheSettings(settings: Partial<CacheSettings>): void {
  eventBus.emit('profile/cache/update', { settings });
}

export function loadProfileMe(): void {
  eventBus.emit('profile/me/load');
}
