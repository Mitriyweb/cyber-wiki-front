/**
 * API Tokens Actions.
 */

import { eventBus } from '@cyberfabric/react';
import type { ApiTokenCreate } from '@/app/api';

export function loadApiTokens(): void {
  eventBus.emit('profile/api-tokens/load');
}

export function createApiToken(data: ApiTokenCreate): void {
  eventBus.emit('profile/api-token/create', { data });
}

export function deleteApiToken(id: string): void {
  eventBus.emit('profile/api-token/delete', { id });
}
