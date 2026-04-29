/**
 * User Branch Actions
 *
 * Pure void emitters for user-branch domain (per-user task branches, PR ops).
 * Per FR cpt-cyberwiki-fr-save-commit.
 */

import { eventBus } from '@cyberfabric/react';

export function loadWorkspace(spaceId: string): void {
  eventBus.emit('wiki/workspace/load', { spaceId });
}

export function createTask(spaceId: string, name: string): void {
  eventBus.emit('wiki/task/create', { spaceId, name });
}

export function selectTask(branchId: string): void {
  eventBus.emit('wiki/task/select', { branchId });
}

export function renameTask(branchId: string, name: string): void {
  eventBus.emit('wiki/task/rename', { branchId, name });
}

export function deleteTask(branchId: string): void {
  eventBus.emit('wiki/task/delete', { branchId });
}

export function createPullRequest(payload: {
  spaceId: string;
  branchId?: string;
  title?: string;
  description?: string;
}): void {
  eventBus.emit('wiki/pr/create', payload);
}

export function deletePr(spaceId: string, branchId?: string): void {
  eventBus.emit('wiki/pr/delete', { spaceId, branchId });
}

export function unstageBranch(spaceId: string, branchId?: string): void {
  eventBus.emit('wiki/branch/unstage', { spaceId, branchId });
}

export function rebaseBranch(spaceId: string, branchId?: string): void {
  eventBus.emit('wiki/branch/rebase', { spaceId, branchId });
}

export function discardBranch(spaceId: string, branchId?: string): void {
  eventBus.emit('wiki/branch/discard', { spaceId, branchId });
}
