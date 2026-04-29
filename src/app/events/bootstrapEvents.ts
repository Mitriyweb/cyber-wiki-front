/**
 * Bootstrap Events
 * App-level events for bootstrap operations
 */

import '@cyberfabric/react';
import type { ApiUser, LoginRequest } from '@/app/api';

/**
 * Module augmentation for type-safe event payloads
 * Define payload types for each event
 *
 * NOTE: We augment @cyberfabric/react's EventPayloadMap interface.
 * This maintains layer architecture by not importing from L1 packages directly.
 * The @cyberfabric/react package re-declares EventPayloadMap to enable this pattern.
 */
declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Fetch current user - no payload needed */
    'app/user/fetch': void;
    /** User data loaded - carries user payload for header update */
    'app/user/loaded': { user: ApiUser };
    /** Login request */
    'app/auth/login': LoginRequest;
    /** Login succeeded */
    'app/auth/login/success': { token: string };
    /** Login failed */
    'app/auth/login/error': { error: string };
    /** Logout request */
    'app/auth/logout': void;
    /** Auth state changed (authenticated or not) */
    'app/auth/state': { authenticated: boolean };
  }
}
