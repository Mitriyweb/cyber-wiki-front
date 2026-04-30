/**
 * Git Operations Log Actions
 * Fire-and-forget actions emitting events for the gitOpsLog effects to handle.
 */

import { eventBus } from '@cyberfabric/react';

export function loadGitOpsLog(limit = 100): void {
  eventBus.emit('wiki/gitOpsLog/load', { limit });
}

export function clearGitOpsLog(): void {
  eventBus.emit('wiki/gitOpsLog/clear');
}
