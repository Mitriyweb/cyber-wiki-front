/**
 * Performance tracking utility for API calls and operations.
 * Logs performance metrics and warns about slow operations.
 *
 * Ported from doclab utils/performanceTracker.ts.
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  dataSize?: number;
  timestamp: number;
  url?: string;
}

const SLOW_THRESHOLD_MS = 1000;
const metrics: PerformanceMetric[] = [];

/**
 * Track an API call or operation performance.
 */
export async function trackPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  url?: string,
): Promise<T> {
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

    const metric: PerformanceMetric = {
      operation,
      duration,
      dataSize,
      timestamp: startTimestamp,
      url,
    };
    metrics.push(metric);

    const dataSizeStr = dataSize ? ` (${formatBytes(dataSize)})` : '';
    const durationStr = duration.toFixed(0);
    if (duration > SLOW_THRESHOLD_MS) {
      console.warn(
        `[Performance] SLOW: ${operation} took ${durationStr}ms${dataSizeStr}`,
        { url, duration, dataSize },
      );
    } else {
      console.log(`[Performance] ${operation} took ${durationStr}ms${dataSizeStr}`, {
        url,
        duration,
        dataSize,
      });
    }
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[Performance] ${operation} failed after ${duration.toFixed(0)}ms`,
      { url, error },
    );
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
