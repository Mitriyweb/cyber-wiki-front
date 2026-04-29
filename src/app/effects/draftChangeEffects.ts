/**
 * Draft Change Effects
 *
 * Effects for the draft-change domain (load, save, discard, commit).
 * Following flux: events from actions → API call → result event.
 */

import { eventBus, apiRegistry } from '@cyberfabric/react';
import { toLower } from 'lodash';
import { DraftChangesApiService } from '@/app/api/DraftChangesApiService';
import { extractErrorMessage } from '@/app/lib/errorMessage';

export function registerDraftChangeEffects(): void {
  // Load drafts (optionally filtered by space)
  eventBus.on('wiki/drafts/load', async ({ spaceId }) => {
    try {
      if (!apiRegistry.has(DraftChangesApiService)) return;
      const service = apiRegistry.getService(DraftChangesApiService);
      const drafts = spaceId
        ? await service.listForSpace({ spaceId })
        : await service.listAll();
      eventBus.emit('wiki/drafts/loaded', { spaceId, drafts: drafts ?? [] });
    } catch (error) {
      eventBus.emit('wiki/draft/error', {
        error: extractErrorMessage(error instanceof Error ? error : null, 'Failed to load draft changes'),
      });
    }
  });

  // Get a single draft
  eventBus.on('wiki/draft/get', async ({ changeId }) => {
    try {
      const service = apiRegistry.getService(DraftChangesApiService);
      const draft = await service.getById({ changeId }).fetch();
      if (draft) {
        eventBus.emit('wiki/draft/got', { draft });
      }
    } catch (error) {
      eventBus.emit('wiki/draft/error', {
        error: extractErrorMessage(error instanceof Error ? error : null, 'Failed to load draft change'),
      });
    }
  });

  // Save (upsert) a draft
  eventBus.on('wiki/draft/save', async (payload) => {
    try {
      const service = apiRegistry.getService(DraftChangesApiService);
      const result = await service.save.fetch({
        space_id: payload.spaceId,
        file_path: payload.filePath,
        original_content: payload.originalContent,
        modified_content: payload.modifiedContent,
        change_type: payload.changeType,
        description: payload.description,
      });
      if (result) {
        eventBus.emit('wiki/draft/saved', {
          changeId: result.id,
          created: result.created,
        });
      }
    } catch (error) {
      eventBus.emit('wiki/draft/error', {
        error: extractErrorMessage(error instanceof Error ? error : null, 'Failed to save draft change'),
      });
    }
  });

  // Discard a draft. Treat 404 as success — the draft is already gone (a
  // commit removed it on the server, or another tab discarded it first), and
  // the user-visible outcome ("the row is gone") is the same. The list reload
  // triggered by `wiki/draft/discarded` will reconcile any lingering UI state.
  eventBus.on('wiki/draft/discard', async ({ changeId }) => {
    const service = apiRegistry.getService(DraftChangesApiService);
    try {
      await service.discard(changeId);
      eventBus.emit('wiki/draft/discarded', { changeId });
    } catch (error) {
      const message = extractErrorMessage(error instanceof Error ? error : null, 'Failed to discard draft change');
      const lower = toLower(message);
      const is404 =
        lower.includes('404') ||
        lower.includes('not found') ||
        lower.includes('no userdraftchange');
      if (is404) {
        eventBus.emit('wiki/draft/discarded', { changeId });
      } else {
        eventBus.emit('wiki/draft/error', { error: message });
      }
    }
  });

  // Commit selected drafts
  eventBus.on('wiki/draft/commit', async ({ changeIds, commitMessage }) => {
    try {
      const service = apiRegistry.getService(DraftChangesApiService);
      const result = await service.commit.fetch({
        change_ids: changeIds,
        commit_message: commitMessage,
      });
      if (!result) return;
      if (result.success) {
        eventBus.emit('wiki/draft/committed', {
          commitSha: result.commit_sha,
          branchName: result.branch_name,
          filesCommitted: result.files_committed,
          spaceId: result.space_id,
          spaceSlug: result.space_slug,
        });
      } else {
        eventBus.emit('wiki/draft/error', {
          error: result.message ?? 'Commit failed',
        });
      }
    } catch (error) {
      eventBus.emit('wiki/draft/error', {
        error: extractErrorMessage(error instanceof Error ? error : null, 'Failed to commit draft changes'),
      });
    }
  });
}
