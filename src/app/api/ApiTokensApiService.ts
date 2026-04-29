/**
 * API Tokens Service — per-user personal access tokens.
 * Connected to /api/user_management/v1/tokens.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type { ApiToken, ApiTokenCreate } from './wikiTypes';

export class ApiTokensApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api/user_management/v1' }, restProtocol, restEndpoints);
  }

  readonly list = this.protocol(RestEndpointProtocol)
    .query<ApiToken[]>('/tokens');

  readonly create = this.protocol(RestEndpointProtocol)
    .mutation<ApiToken, ApiTokenCreate>('POST', '/tokens');

  async delete(id: string): Promise<void> {
    await this.protocol(RestProtocol).delete(
      `/tokens/${encodeURIComponent(id)}`,
    );
  }
}
