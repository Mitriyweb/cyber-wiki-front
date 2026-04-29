/**
 * Enrichment Actions
 *
 * Actions for enrichment domain operations (enrichments, comments).
 * Following flux architecture: Actions emit events, Effects listen and dispatch.
 */

import { eventBus } from '@cyberfabric/react';

export function loadEnrichments(sourceUri: string): void {
  eventBus.emit('wiki/enrichments/load', { sourceUri });
}

export function loadComments(sourceUri: string): void {
  eventBus.emit('wiki/comments/load', { sourceUri });
}

export function loadAllComments(opts: { isResolved?: boolean } = {}): void {
  eventBus.emit('wiki/comments/all/load', opts);
}

export function createComment(
  sourceUri: string,
  text: string,
  lineStart?: number,
  lineEnd?: number,
  parentComment?: string,
): void {
  eventBus.emit('wiki/comment/create', { sourceUri, text, lineStart, lineEnd, parentComment });
}

export function deleteComment(commentId: string, sourceUri: string): void {
  eventBus.emit('wiki/comment/delete', { commentId, sourceUri });
}

export function resolveComment(commentId: string, isResolved: boolean, sourceUri: string): void {
  eventBus.emit('wiki/comment/resolve', { commentId, isResolved, sourceUri });
}
