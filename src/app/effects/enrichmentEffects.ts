/**
 * Enrichment Effects
 *
 * Effects for enrichment domain operations (enrichments, comments, drafts).
 * Following flux architecture: Listen to events from actions, call API services, emit results.
 */

import { eventBus, apiRegistry } from '@cyberfabric/react';
import { EnrichmentsApiService } from '@/app/api';

export function registerEnrichmentEffects(): void {
  // Load enrichments for a source URI
  eventBus.on('wiki/enrichments/load', async ({ sourceUri }) => {
    try {
      if (!apiRegistry.has(EnrichmentsApiService)) return;
      const service = apiRegistry.getService(EnrichmentsApiService);
      const enrichments = await service.getEnrichments(sourceUri);
      eventBus.emit('wiki/enrichments/loaded', { sourceUri, enrichments });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load enrichments';
      eventBus.emit('wiki/enrichments/error', { error: message });
    }
  });

  // Load comments
  eventBus.on('wiki/comments/load', async ({ sourceUri }) => {
    try {
      const service = apiRegistry.getService(EnrichmentsApiService);
      const comments = await service.listComments(sourceUri);
      eventBus.emit('wiki/comments/loaded', { sourceUri, comments: comments || [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load comments';
      eventBus.emit('wiki/comment/error', { error: message });
    }
  });

  // Load every comment the user can see (no source_uri filter).
  eventBus.on('wiki/comments/all/load', async ({ isResolved }) => {
    try {
      const service = apiRegistry.getService(EnrichmentsApiService);
      const comments = await service.listAllComments({ isResolved });
      eventBus.emit('wiki/comments/all/loaded', { comments: comments || [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load all comments';
      eventBus.emit('wiki/comment/error', { error: message });
    }
  });

  // Create comment
  eventBus.on('wiki/comment/create', async ({ sourceUri, text, lineStart, lineEnd, parentComment }) => {
    try {
      const service = apiRegistry.getService(EnrichmentsApiService);
      const comment = await service.createComment({
        source_uri: sourceUri,
        text,
        line_start: lineStart,
        line_end: lineEnd,
        parent_comment: parentComment,
      });
      eventBus.emit('wiki/comment/created', { comment });
      eventBus.emit('wiki/comments/load', { sourceUri });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create comment';
      eventBus.emit('wiki/comment/error', { error: message });
    }
  });

  // Delete comment
  eventBus.on('wiki/comment/delete', async ({ commentId, sourceUri }) => {
    try {
      const service = apiRegistry.getService(EnrichmentsApiService);
      await service.deleteComment(commentId);
      eventBus.emit('wiki/comment/deleted', { commentId });
      eventBus.emit('wiki/comments/load', { sourceUri });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete comment';
      eventBus.emit('wiki/comment/error', { error: message });
    }
  });

  // Resolve / unresolve comment
  eventBus.on('wiki/comment/resolve', async ({ commentId, isResolved, sourceUri }) => {
    try {
      const service = apiRegistry.getService(EnrichmentsApiService);
      const comment = isResolved
        ? await service.unresolveComment(commentId)
        : await service.resolveComment(commentId);
      eventBus.emit('wiki/comment/resolved', { comment });
      eventBus.emit('wiki/comments/load', { sourceUri });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve comment';
      eventBus.emit('wiki/comment/error', { error: message });
    }
  });

}
