/**
 * HTTP status codes used across the app — single source of truth so
 * features don't redefine them as inline literals (`status === 401`) or
 * local enums.
 *
 * Add new entries lazily as features need them; keeping the enum small
 * avoids dragging unrelated codes into the bundle.
 */
export enum HttpStatus {
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
}
