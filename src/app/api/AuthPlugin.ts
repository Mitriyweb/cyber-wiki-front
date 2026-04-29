import { RestPlugin } from '@cyberfabric/react';
import type { RestRequestContext, RestShortCircuitResponse } from '@cyberfabric/react';

const TOKEN_KEY = 'cyberwiki_auth_token';

export class AuthPlugin extends RestPlugin {
  onRequest(
    context: RestRequestContext,
  ): RestRequestContext | RestShortCircuitResponse {
    const token = AuthPlugin.getToken();
    if (!token) {
      return context;
    }

    return {
      ...context,
      headers: {
        ...context.headers,
        Authorization: `Bearer ${token}`,
      },
    };
  }

  static saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  static clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
}
