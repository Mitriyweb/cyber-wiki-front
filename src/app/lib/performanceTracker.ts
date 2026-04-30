/**
 * Performance tracking utility for API calls and operations.
 * Logs performance metrics and warns about slow operations.
 *
 * Ported from doclab utils/performanceTracker.ts.
 *
 * Both the metric ring-buffer AND the console traces are gated behind the
 * `perfLogEnabled` user setting (Profile → Performance log toggle). When
 * the toggle is OFF, `pushMetric` is a no-op and `trackPerformance` skips
 * timing/recording entirely. Toggle it ON only when actively diagnosing
 * a slow request.
 */

export interface PerformanceMetric {
  operation: string;
  duration: number;
  dataSize?: number;
  timestamp: number;
  url?: string;
}

const SLOW_THRESHOLD_MS = 1000;
const metrics: PerformanceMetric[] = [];

/**
 * Live flag set from the userSettings effect — `setPerfLogEnabled(true)`
 * after `user/settings/loaded` (see effects/userSettingsEffects). Kept as a
 * module-local mutable boolean so `trackPerformance` can read it without an
 * eventBus subscription per call.
 */
let perfLogEnabled = false;

export function setPerfLogEnabled(value: boolean): void {
  perfLogEnabled = value;
}

export function isPerfLogEnabled(): boolean {
  return perfLogEnabled;
}

/**
 * Track an API call or operation performance.
 *
 * When the perf log toggle is OFF this is just a passthrough — no timing,
 * no recording, no console output — so production sessions don't pay for
 * Blob-serialising every response just to discard it.
 */
export async function trackPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  url?: string,
): Promise<T> {
  if (!perfLogEnabled) {
    return fn();
  }

  const startTime = performance.now();
  const startTimestamp = Date.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    let dataSize: number | undefined;

    if (result !== undefined && result !== null) {
      try {
        const jsonString = JSON.stringify(result);
        dataSize = new Blob([jsonString]).size;
      } catch {
        // Non-serialisable; ignore.
      }
    }

    metrics.push({
      operation,
      duration,
      dataSize,
      timestamp: startTimestamp,
      url,
    });

    const dataSizeStr = dataSize ? ` (${formatBytes(dataSize)})` : '';
    const durationStr = duration.toFixed(0);
    const meta = { url, duration, dataSize };
    if (duration > SLOW_THRESHOLD_MS) {
      console.warn(`[Performance] SLOW: ${operation} took ${durationStr}ms${dataSizeStr}`, meta);
    } else {
      console.info(`[Performance] ${operation} took ${durationStr}ms${dataSizeStr}`, meta);
    }
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[Performance] ${operation} failed after ${duration.toFixed(0)}ms`, {
      url,
      error,
    });
    throw error;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function getMetrics(): PerformanceMetric[] {
  return [...metrics];
}

export function getSlowOperations(threshold = SLOW_THRESHOLD_MS): PerformanceMetric[] {
  return metrics.filter((m) => m.duration > threshold);
}

export function pushMetric(metric: PerformanceMetric): void {
  if (!perfLogEnabled) return;
  metrics.push(metric);
}

export function clearMetrics(): void {
  metrics.length = 0;
}

export function getPerformanceSummary(): {
  total: number;
  slow: number;
  avgDuration: number;
  totalDataSize: number;
} {
  const total = metrics.length;
  const slow = metrics.filter((m) => m.duration > SLOW_THRESHOLD_MS).length;
  const avgDuration = total > 0 ? metrics.reduce((sum, m) => sum + m.duration, 0) / total : 0;
  const totalDataSize = metrics.reduce((sum, m) => sum + (m.dataSize ?? 0), 0);
  return { total, slow, avgDuration, totalDataSize };
}
