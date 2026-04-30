/**
 * Notify — single entry point for user-facing notifications.
 *
 * Wraps sonner so the rest of the app does not import the toast library
 * directly. ESLint bans `console.*` in production code outside this file
 * (see eslint.config.js), so any developer-visible breadcrumb must come
 * through `notify({ dev: true })`.
 */

import { toast } from 'sonner';
import { extractErrorMessage } from './errorMessage';

/** Console level a `notify(... { dev: true })` call should hit. */
export enum DevLogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
}

interface NotifyOptions {
  /** Optional sub-message under the main one. */
  description?: string;
  /** Auto-dismiss in ms; falsy → sonner default. */
  duration?: number;
  /** Also write to the browser console in dev builds. */
  dev?: boolean;
}

function devLog(level: DevLogLevel, message: string, opts: NotifyOptions): void {
  if (!opts.dev || !import.meta.env.DEV) return;
  const target =
    level === DevLogLevel.Error
      ? console.error
      : level === DevLogLevel.Warn
        ? console.warn
        : console.info;
  target.call(console, `[notify:${level}] ${message}`, opts);
}

export const notify = {
  success(message: string, options: NotifyOptions = {}): void {
    toast.success(message, options);
  },
  info(message: string, options: NotifyOptions = {}): void {
    toast.info(message, options);
    devLog(DevLogLevel.Info, message, options);
  },
  warn(message: string, options: NotifyOptions = {}): void {
    toast.warning(message, options);
    devLog(DevLogLevel.Warn, message, options);
  },
  error(message: string, options: NotifyOptions = {}): void {
    toast.error(message, options);
    devLog(DevLogLevel.Error, message, options);
  },
};

/**
 * Thin wrapper over `extractErrorMessage` that takes the result of a
 * `try/catch` block (where TS gives you `unknown`) and returns a
 * human-readable string suitable for `notify.error(...)`.
 *
 * Call as `describeError(err instanceof Error ? err : null, 'Failed to X')`
 * — keeping the narrow boundary type out of public surfaces.
 */
export function describeError(
  error: Error | string | null,
  fallback = 'Something went wrong',
): string {
  return extractErrorMessage(error, fallback);
}
