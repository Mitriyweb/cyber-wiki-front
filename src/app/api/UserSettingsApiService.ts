/**
 * User Settings API Service
 * Connected to /api/user_management/v1/settings.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type { CacheSettings } from './wikiTypes';

export class UserSettingsApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api/user_management/v1' }, restProtocol, restEndpoints);
  }

  readonly getCacheSettings = this.protocol(RestEndpointProtocol)
    .query<CacheSettings>('/settings/cache/');

  readonly updateCacheSettings = this.protocol(RestEndpointProtocol)
    .mutation<CacheSettings, Partial<CacheSettings>>('PUT', '/settings/cache/');
}
