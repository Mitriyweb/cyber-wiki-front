import { RestPlugin } from '@cyberfabric/react';
import type { RestRequestContext, RestShortCircuitResponse } from '@cyberfabric/react';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class CsrfPlugin extends RestPlugin {
  onRequest(
    context: RestRequestContext,
  ): RestRequestContext | RestShortCircuitResponse {
    if (!MUTATING_METHODS.has(context.method)) {
      return context;
    }

    return {
      ...context,
      headers: {
        ...context.headers,
        'X-CSRFToken': getCsrfToken(),
      },
    };
  }
}
