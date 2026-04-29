/**
 * API Tokens Events — per-user personal access tokens.
 */

import '@cyberfabric/react';
import type { ApiToken, ApiTokenCreate } from '@/app/api';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    'profile/api-tokens/load': void;
    'profile/api-tokens/loaded': { tokens: ApiToken[] };

    'profile/api-token/create': { data: ApiTokenCreate };
    /** Created token includes the plaintext `token` field — show it once. */
    'profile/api-token/created': { token: ApiToken };

    'profile/api-token/delete': { id: string };
    'profile/api-token/deleted': { id: string };

    'profile/api-tokens/error': { error: string };
  }
}
