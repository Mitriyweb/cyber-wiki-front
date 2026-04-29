/**
 * API Tokens Effects.
 */

import { eventBus, apiRegistry } from '@cyberfabric/react';
import { ApiTokensApiService } from '@/app/api/ApiTokensApiService';

export function registerApiTokensEffects(): void {
  eventBus.on('profile/api-tokens/load', async () => {
    try {
      if (!apiRegistry.has(ApiTokensApiService)) return;
      const service = apiRegistry.getService(ApiTokensApiService);
      const tokens = await service.list.fetch();
      eventBus.emit('profile/api-tokens/loaded', { tokens: tokens ?? [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load API tokens';
      eventBus.emit('profile/api-tokens/error', { error: message });
    }
  });

  eventBus.on('profile/api-token/create', async ({ data }) => {
    try {
      const service = apiRegistry.getService(ApiTokensApiService);
      const token = await service.create.fetch(data);
      if (token) {
        eventBus.emit('profile/api-token/created', { token });
        eventBus.emit('profile/api-tokens/load');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create API token';
      eventBus.emit('profile/api-tokens/error', { error: message });
    }
  });

  eventBus.on('profile/api-token/delete', async ({ id }) => {
    try {
      const service = apiRegistry.getService(ApiTokensApiService);
      await service.delete(id);
      eventBus.emit('profile/api-token/deleted', { id });
      eventBus.emit('profile/api-tokens/load');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete API token';
      eventBus.emit('profile/api-tokens/error', { error: message });
    }
  });
}
