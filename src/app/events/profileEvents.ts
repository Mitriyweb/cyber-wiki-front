/**
 * Profile Events
 * Event type declarations for profile domain (service tokens)
 */

import '@cyberfabric/react';
import type { ServiceToken, ServiceTokenCreate, TokenValidationResult, CacheSettings } from '@/app/api/wikiTypes';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Load service tokens for current user */
    'profile/tokens/load': void;
    /** Service tokens loaded */
    'profile/tokens/loaded': { tokens: ServiceToken[] };
    /** Save (create/update) a service token */
    'profile/tokens/save': { data: ServiceTokenCreate };
    /** Service token saved */
    'profile/tokens/saved': { token: ServiceToken };
    /** Delete a service token */
    'profile/tokens/delete': { id: string };
    /** Service token deleted */
    'profile/tokens/deleted': { id: string };
    /** Validate a service token */
    'profile/tokens/validate': { id: string };
    /** Validate all configured service tokens */
    'profile/tokens/validate-all': void;
    /** Token validation result */
    'profile/tokens/validated': { id: string; result: TokenValidationResult };
    /** Overall health status of service tokens (emitted after validate-all completes) */
    'profile/tokens/health': { failures: { id: string; serviceType: string; name: string; message: string }[] };
    /** Service token operation error */
    'profile/tokens/error': { error: string };

    /** Load cache settings */
    'profile/cache/load': void;
    /** Cache settings loaded */
    'profile/cache/loaded': { settings: CacheSettings };
    /** Update cache settings */
    'profile/cache/update': { settings: Partial<CacheSettings> };
    /** Cache settings updated */
    'profile/cache/updated': { settings: CacheSettings };
  }
}
