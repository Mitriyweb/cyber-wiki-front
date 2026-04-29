/**
 * Extracts a human-readable error message from whatever the API client
 * threw. Axios-style errors put the server's body at `error.response.data`,
 * while plain `Error` instances just have `.message`. The default
 * `error.message` of an axios failure is usually "Request failed with
 * status code 400" — useless to a user, so we drill into the body first.
 *
 * Recognised body shapes (in order of preference):
 *   - { error: string }
 *   - { detail: string }                   (DRF default)
 *   - { message: string }
 *   - { non_field_errors: string[] }       (DRF serializer rejection)
 *   - { <field>: string[] }                (DRF field-level errors)
 *   - any other object → JSON-stringified
 */
import type { JsonValue } from '@cyberfabric/react';
import { isString } from 'lodash';

interface ApiErrorResponse {
  status?: number;
  data?: JsonValue;
}

export interface CaughtApiError {
  message?: string;
  name?: string;
  response?: ApiErrorResponse;
}

function asObject(value: Error): CaughtApiError {
  return value as CaughtApiError;
}

function pickFromBody(body: JsonValue | undefined | null): string | null {
  if (body == null) return null;
  if (isString(body)) return body;
  if (typeof body !== 'object' || Array.isArray(body)) return null;

  const obj = body;
  if (isString(obj.error)) return obj.error;
  if (isString(obj.detail)) return obj.detail;
  if (isString(obj.message)) return obj.message;

  const nonField = obj.non_field_errors;
  if (Array.isArray(nonField) && isString(nonField[0])) {
    return nonField[0];
  }

  // First field-level error: `{"name": ["This field is required."]}`.
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value) && isString(value[0])) {
      return `${key}: ${value[0]}`;
    }
    if (isString(value)) {
      return `${key}: ${value}`;
    }
  }

  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

/**
 * Pull the most useful message out of a caught error. Pass the result of
 * `error instanceof Error ? error : null` from your catch block — non-Error
 * throws (rare in practice) just get the fallback. Also accepts plain
 * strings for completeness.
 */
export function extractErrorMessage(
  error: Error | string | null,
  fallback: string,
): string {
  if (error == null) return fallback;
  if (isString(error)) return error;

  const obj = asObject(error);
  const fromBody = pickFromBody(obj.response?.data);
  if (fromBody) return fromBody;
  if (isString(obj.message) && !obj.message.startsWith('Request failed')) {
    return obj.message;
  }
  if (error.message && !error.message.startsWith('Request failed')) {
    return error.message;
  }
  return fallback;
}

/** Convenience: narrow `unknown` from a catch block before extraction. */
export function extractErrorMessageFromCatch(thrown: Error | string | null, fallback: string): string {
  return extractErrorMessage(thrown, fallback);
}
