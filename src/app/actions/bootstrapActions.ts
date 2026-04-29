// @cpt-flow:cpt-frontx-flow-framework-composition-app-bootstrap:p1

/**
 * Bootstrap Actions
 *
 * Actions for app-level bootstrap operations.
 * Following flux architecture: Actions emit events, Effects listen and dispatch.
 */

import { eventBus } from '@cyberfabric/react';
import type { ApiUser, LoginRequest } from '@/app/api';

/**
 * Fetch current user
 * Emits 'app/user/fetch' event
 */
// @cpt-begin:cpt-frontx-flow-framework-composition-app-bootstrap:p1:inst-1
export function fetchCurrentUser(): void {
  eventBus.emit('app/user/fetch');
}

/**
 * Notify that user data has been loaded
 * Called by screens after successfully fetching user data.
 * Emits 'app/user/loaded' event so header state updates.
 */
export function notifyUserLoaded(user: ApiUser): void {
  eventBus.emit('app/user/loaded', { user });
}
// @cpt-end:cpt-frontx-flow-framework-composition-app-bootstrap:p1:inst-1

/**
 * Login with username and password
 * Emits 'app/auth/login' event
 */
export function loginAction(credentials: LoginRequest): void {
  eventBus.emit('app/auth/login', credentials);
}

/**
 * Logout current user
 * Emits 'app/auth/logout' event
 */
export function logoutAction(): void {
  eventBus.emit('app/auth/logout');
}
