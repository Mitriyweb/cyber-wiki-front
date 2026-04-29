/**
 * Profile Effects
 * Effects for profile domain (service tokens).
 * Following flux architecture: Listen to events, call API, emit result events.
 */

import { eventBus, apiRegistry } from '@cyberfabric/react';
import { ServiceTokensApiService } from '@/app/api/ServiceTokensApiService';
import { UserSettingsApiService } from '@/app/api/UserSettingsApiService';

let forceRefresh = false;

export function registerProfileEffects(): void {
  eventBus.on('profile/tokens/load', async () => {
    try {
      const service = apiRegistry.getService(ServiceTokensApiService);
      const tokens = await service.listTokens.fetch(forceRefresh ? { staleTime: 0 } : undefined);
      forceRefresh = false;
      eventBus.emit('profile/tokens/loaded', { tokens: tokens ?? [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load tokens';
      eventBus.emit('profile/tokens/error', { error: message });
    }
  });

  eventBus.on('profile/tokens/save', async ({ data }) => {
    try {
      const service = apiRegistry.getService(ServiceTokensApiService);
      const token = await service.createToken.fetch(data);
      if (token) {
        eventBus.emit('profile/tokens/saved', { token });
        eventBus.emit('profile/tokens/validate', { id: token.id });
      }
      forceRefresh = true;
      eventBus.emit('profile/tokens/load');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save token';
      eventBus.emit('profile/tokens/error', { error: message });
    }
  });

  eventBus.on('profile/tokens/delete', async ({ id }) => {
    try {
      const service = apiRegistry.getService(ServiceTokensApiService);
      await service.deleteToken(id);
      eventBus.emit('profile/tokens/deleted', { id });
      forceRefresh = true;
      eventBus.emit('profile/tokens/load');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete token';
      eventBus.emit('profile/tokens/error', { error: message });
    }
  });

  eventBus.on('profile/tokens/validate', async ({ id }) => {
    try {
      const service = apiRegistry.getService(ServiceTokensApiService);
      const result = await service.validateToken(id);
      eventBus.emit('profile/tokens/validated', { id, result });
      forceRefresh = true;
      eventBus.emit('profile/tokens/load');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      eventBus.emit('profile/tokens/validated', {
        id,
        result: { valid: false, message, details: {} },
      });
    }
  });

  eventBus.on('profile/tokens/validate-all', async () => {
    try {
      const service = apiRegistry.getService(ServiceTokensApiService);
      forceRefresh = true;
      const tokens = await service.listTokens.fetch({ staleTime: 0 });
      const configured = (tokens ?? []).filter((t) => t.has_token);

      const failures: { id: string; serviceType: string; name: string; message: string }[] = [];

      await Promise.all(
        configured.map(async (token) => {
          try {
            const result = await service.validateToken(token.id);
            eventBus.emit('profile/tokens/validated', { id: token.id, result });
            if (!result.valid) {
              failures.push({
                id: token.id,
                serviceType: token.service_type,
                name: token.name || token.service_type,
                message: result.message,
              });
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Validation failed';
            eventBus.emit('profile/tokens/validated', {
              id: token.id,
              result: { valid: false, message: msg, details: {} },
            });
            failures.push({
              id: token.id,
              serviceType: token.service_type,
              name: token.name || token.service_type,
              message: msg,
            });
          }
        }),
      );

      forceRefresh = true;
      eventBus.emit('profile/tokens/load');
      eventBus.emit('profile/tokens/health', { failures });
    } catch {
      // If we can't even list tokens, skip health check silently
    }
  });

  // ── Cache settings ────────────────────────────────────────────────────

  eventBus.on('profile/cache/load', async () => {
    try {
      const service = apiRegistry.getService(UserSettingsApiService);
      const settings = await service.getCacheSettings.fetch({ staleTime: 0 });
      if (settings) {
        eventBus.emit('profile/cache/loaded', { settings });
      }
    } catch {
      // Silently ignore — page will show defaults
    }
  });

  eventBus.on('profile/cache/update', async ({ settings: patch }) => {
    try {
      const service = apiRegistry.getService(UserSettingsApiService);
      const updated = await service.updateCacheSettings.fetch(patch);
      if (updated) {
        eventBus.emit('profile/cache/updated', { settings: updated });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update cache settings';
      eventBus.emit('profile/tokens/error', { error: message });
    }
  });
}
