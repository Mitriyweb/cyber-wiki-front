/**
 * i18n — translate strings from non-React contexts.
 *
 * `useTranslation` is a React hook and is unusable in effects, services,
 * or other plain-module code. Both surfaces share the same singleton
 * registry from `@cyberfabric/i18n`, so this helper just forwards the
 * call. The singleton's loader and active language are configured in
 * `main.tsx`; by the time any effect runs the dictionary is already
 * populated.
 */

import { i18nRegistry } from '@cyberfabric/react';

type TranslationParams = Record<string, string | number | boolean>;

export function t(key: string, params?: TranslationParams): string {
  return i18nRegistry.t(key, params);
}
