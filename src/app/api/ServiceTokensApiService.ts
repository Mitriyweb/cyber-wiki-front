/**
 * Service Tokens Domain - API Service
 * Service for managing service tokens (GitHub, Bitbucket, JIRA, Custom Header).
 * Connected to real Django backend via /api/service-tokens/v1/ endpoints.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type { ServiceToken, ServiceTokenCreate, TokenValidationResult } from './wikiTypes';

export class ServiceTokensApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api/service-tokens/v1' }, restProtocol, restEndpoints);
  }

  readonly listTokens = this.protocol(RestEndpointProtocol)
    .query<ServiceToken[]>('/tokens/');

  readonly createToken = this.protocol(RestEndpointProtocol)
    .mutation<ServiceToken, ServiceTokenCreate>('POST', '/tokens/');

  async deleteToken(id: string): Promise<void> {
    await this.protocol(RestProtocol).delete(`/tokens/${id}/`);
  }

  async validateToken(id: string): Promise<TokenValidationResult> {
    return this.protocol(RestProtocol).post(`/tokens/${id}/validate/`);
  }
}
