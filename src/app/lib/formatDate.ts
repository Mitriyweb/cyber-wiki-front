/**
 * Date formatting helpers.
 *
 * Single boundary for "render a date in the UI" so that:
 * - Locale + format choices live in one place (i18n later just plugs in here).
 * - Inputs are normalized: ISO strings, numeric epoch (s or ms), or Date.
 * - Invalid / missing values render as a typographic em-dash, not "Invalid Date".
 *
 * Direct `new Date(x).toLocaleDateString()` / `toLocaleString()` calls in
 * components/pages are banned (lint).
 */

import { trim } from 'lodash';

const MISSING = '—';

export type DateInput = string | number | Date | null | undefined;

/**
 * Convert any of the accepted inputs into a valid Date, or `null` if the
 * input is missing or unparseable. Numeric values < 1e12 are treated as
 * Unix seconds (most backend payloads use seconds; some use ms).
 */
export function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = trim(input);
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Date only: "Apr 30, 2026" (locale default). */
export function formatDate(input: DateInput, fallback: string = MISSING): string {
  const d = toDate(input);
  return d ? d.toLocaleDateString() : fallback;
}

/** Date + time: "4/30/2026, 9:15:00 AM" (locale default). */
export function formatDateTime(input: DateInput, fallback: string = MISSING): string {
  const d = toDate(input);
  return d ? d.toLocaleString() : fallback;
}

/** Time only: "9:15 AM" (locale default). */
export function formatTime(input: DateInput, fallback: string = MISSING): string {
  const d = toDate(input);
  return d ? d.toLocaleTimeString() : fallback;
}
