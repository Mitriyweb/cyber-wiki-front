/**
 * Git Operations Log Events
 *
 * Per-user ring buffer of git commit/PR results — used by the Debug tab and
 * the Recent Commits panel on the Changes page.
 */

import '@cyberfabric/react';
import type { GitOpsLogEntry } from '@/app/api/wikiTypes';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Reload the per-user git operations log */
    'wiki/gitOpsLog/load': { limit?: number };
    /** Log entries loaded */
    'wiki/gitOpsLog/loaded': { entries: GitOpsLogEntry[] };
    /** Clear the per-user git operations log */
    'wiki/gitOpsLog/clear': void;
    /** Log was cleared (count of removed entries) */
    'wiki/gitOpsLog/cleared': { cleared: number };
    /** Load/clear failed */
    'wiki/gitOpsLog/error': { error: string };
  }
}
