// @cpt-flow:cpt-frontx-flow-framework-composition-app-bootstrap:p1

/**
 * Bootstrap Effects
 *
 * Effects for app-level bootstrap operations.
 * Following flux architecture: Listen to events from actions, dispatch to slices.
 */

import trim from 'lodash/trim';
import { eventBus, setUser, setHeaderLoading, apiRegistry, type AppDispatch, type HeaderUser } from '@cyberfabric/react';
import { AccountsApiService, type ApiUser, type MeResponse } from '@/app/api';
import { AuthPlugin } from '@/app/api/AuthPlugin';
import { t } from '@/app/lib/i18n';

/**
 * Convert API user to header user info
 */
// @cpt-begin:cpt-frontx-flow-framework-composition-app-bootstrap:p1:inst-1
function toHeaderUser(user: ApiUser): HeaderUser {
  const displayName = trim(`${user.firstName || ''} ${user.lastName || ''}`);
  return {
    displayName: displayName || undefined,
    email: user.email || undefined,
    avatarUrl: user.avatarUrl,
  };
}

/**
 * Convert backend /me response to ApiUser shape
 */
function meResponseToApiUser(me: MeResponse): ApiUser {
  return {
    id: String(me.id),
    email: me.email,
    firstName: me.first_name,
    lastName: me.last_name,
    role: me.role === 'admin' ? 'admin' : 'user',
    language: 'en',
    createdAt: '',
    updatedAt: '',
  } as ApiUser;
}

/**
 * Register bootstrap effects
 * Called once during app initialization
 */
export function registerBootstrapEffects(appDispatch: AppDispatch): void {
  const dispatch = appDispatch;

  // Listen for 'app/user/fetch' event — fetch current user from backend /api/auth/v1/me
  eventBus.on('app/user/fetch', async () => {
    try {
      if (!apiRegistry.has(AccountsApiService)) {
        return;
      }

      dispatch(setHeaderLoading(true));
      const accountsService = apiRegistry.getService(AccountsApiService);
      const meResponse = await accountsService.me.fetch();
      if (meResponse) {
        const user = meResponseToApiUser(meResponse);
        dispatch(setUser(toHeaderUser(user)));
        eventBus.emit('app/auth/state', { authenticated: true });
        eventBus.emit('profile/tokens/validate-all');
      }
    } catch {
      // Expected when there is no session yet — silent, just flip auth state.
      dispatch(setHeaderLoading(false));
      eventBus.emit('app/auth/state', { authenticated: false });
    }
  });

  // Listen for 'app/user/loaded' event - updates header when any screen loads user data
  eventBus.on('app/user/loaded', ({ user }) => {
    dispatch(setUser(toHeaderUser(user)));
  });

  // Listen for 'app/auth/login' event — POST to backend /api/auth/v1/login
  eventBus.on('app/auth/login', async (credentials) => {
    try {
      AuthPlugin.clearToken();
      const accountsService = apiRegistry.getService(AccountsApiService);
      const response = await accountsService.login.fetch(credentials);
      if (response?.token) {
        AuthPlugin.saveToken(response.token);
        eventBus.emit('app/auth/login/success', { token: response.token });
        // Fetch user profile after successful login
        eventBus.emit('app/user/fetch');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.loginFailed');
      eventBus.emit('app/auth/login/error', { error: message });
    }
  });

  // Listen for 'app/auth/logout' event — POST to backend /api/auth/v1/logout
  eventBus.on('app/auth/logout', async () => {
    try {
      const accountsService = apiRegistry.getService(AccountsApiService);
      await accountsService.logout.fetch();
    } catch {
      // Ignore logout errors
    }
    AuthPlugin.clearToken();
    dispatch(setUser(null));
    eventBus.emit('app/auth/state', { authenticated: false });
  });
}
// @cpt-end:cpt-frontx-flow-framework-composition-app-bootstrap:p1:inst-1
