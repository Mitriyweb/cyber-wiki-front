/**
 * Draft Change Actions
 *
 * Pure void emitters for the draft-change domain.
 * Per FR cpt-cyberwiki-fr-save-commit / cpt-cyberwiki-fr-pending-changes.
 */

import { eventBus } from '@cyberfabric/react';
import type { EditChangeType } from '@/app/api';

export function loadDrafts(spaceId?: string): void {
  eventBus.emit('wiki/drafts/load', { spaceId });
}

export function getDraft(changeId: string): void {
  eventBus.emit('wiki/draft/get', { changeId });
}

export function saveDraft(payload: {
  spaceId: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  changeType: EditChangeType;
  description: string;
}): void {
  eventBus.emit('wiki/draft/save', payload);
}

export function discardDraft(changeId: string): void {
  eventBus.emit('wiki/draft/discard', { changeId });
}

export function commitDrafts(changeIds: string[], commitMessage?: string): void {
  eventBus.emit('wiki/draft/commit', { changeIds, commitMessage });
}
