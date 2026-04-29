/**
 * Accounts Domain - API Service
 * Service for accounts domain (users, tenants, authentication, permissions)
 * Connected to real Django backend via /api/auth/v1/ endpoints.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type { MeResponse, LoginRequest, LoginResponse } from './types';

/**
 * Accounts API Service
 * Manages accounts domain endpoints:
 * - Authentication (login, logout)
 * - Current user info (me)
 * All requests go to real backend via Vite proxy.
 */
export class AccountsApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api/auth/v1' }, restProtocol, restEndpoints);
  }

  readonly login = this.protocol(RestEndpointProtocol)
    .mutation<LoginResponse, LoginRequest>('POST', '/login');

  readonly logout = this.protocol(RestEndpointProtocol)
    .mutation<{ message: string }, void>('POST', '/logout');

  readonly me = this.protocol(RestEndpointProtocol)
    .query<MeResponse>('/me');
}
