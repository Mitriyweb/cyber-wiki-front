/**
 * File Mapping Effects
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 */

import { eventBus, apiRegistry } from '@cyberfabric/react';
import { FileMappingApiService } from '@/app/api/FileMappingApiService';
import { t } from '@/app/lib/i18n';

export function registerFileMappingEffects(): void {
  // Load mappings
  eventBus.on('wiki/file-mappings/load', async ({ spaceSlug }) => {
    try {
      if (!apiRegistry.has(FileMappingApiService)) return;
      const service = apiRegistry.getService(FileMappingApiService);
      const mappings = await service.list(spaceSlug);
      eventBus.emit('wiki/file-mappings/loaded', { spaceSlug, mappings: mappings ?? [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToLoadFileMappings');
      eventBus.emit('wiki/file-mapping/error', { error: message });
    }
  });

  // Create mapping
  eventBus.on('wiki/file-mapping/create', async ({ spaceSlug, data }) => {
    try {
      const service = apiRegistry.getService(FileMappingApiService);
      const mapping = await service.create(spaceSlug, data);
      if (mapping) {
        eventBus.emit('wiki/file-mapping/created', { spaceSlug, mapping });
        eventBus.emit('wiki/file-mappings/load', { spaceSlug });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToCreateFileMapping');
      eventBus.emit('wiki/file-mapping/error', { error: message });
    }
  });

  // Update mapping
  eventBus.on('wiki/file-mapping/update', async ({ spaceSlug, id, data }) => {
    try {
      const service = apiRegistry.getService(FileMappingApiService);
      const mapping = await service.update(spaceSlug, id, data);
      if (mapping) {
        eventBus.emit('wiki/file-mapping/updated', { spaceSlug, mapping });
        eventBus.emit('wiki/file-mappings/load', { spaceSlug });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToUpdateFileMapping');
      eventBus.emit('wiki/file-mapping/error', { error: message });
    }
  });

  // Delete mapping
  eventBus.on('wiki/file-mapping/delete', async ({ spaceSlug, id }) => {
    try {
      const service = apiRegistry.getService(FileMappingApiService);
      await service.delete(spaceSlug, id);
      eventBus.emit('wiki/file-mapping/deleted', { spaceSlug, id });
      eventBus.emit('wiki/file-mappings/load', { spaceSlug });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToDeleteFileMapping');
      eventBus.emit('wiki/file-mapping/error', { error: message });
    }
  });

  // Bulk update
  eventBus.on('wiki/file-mappings/bulk-update', async ({ spaceSlug, mappings }) => {
    try {
      const service = apiRegistry.getService(FileMappingApiService);
      const result = await service.bulkUpdate(spaceSlug, mappings);
      eventBus.emit('wiki/file-mappings/bulk-updated', {
        spaceSlug,
        mappings: result ?? [],
      });
      eventBus.emit('wiki/file-mappings/load', { spaceSlug });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToBulkUpdateFileMappings');
      eventBus.emit('wiki/file-mapping/error', { error: message });
    }
  });

  // Apply folder rule
  eventBus.on(
    'wiki/file-mapping/apply-folder-rule',
    async ({ spaceSlug, folderPath, rule, applyToChildren }) => {
      try {
        const service = apiRegistry.getService(FileMappingApiService);
        const mapping = await service.applyFolderRule(
          spaceSlug,
          folderPath,
          rule,
          applyToChildren,
        );
        if (mapping) {
          eventBus.emit('wiki/file-mapping/folder-rule-applied', { spaceSlug, mapping });
          eventBus.emit('wiki/file-mappings/load', { spaceSlug });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('errors.failedToApplyFolderRule');
        eventBus.emit('wiki/file-mapping/error', { error: message });
      }
    },
  );

  // Extract names
  eventBus.on(
    'wiki/file-mapping/extract-names',
    async ({ spaceSlug, filePaths, source }) => {
      try {
        const service = apiRegistry.getService(FileMappingApiService);
        const result = await service.extractNames(spaceSlug, filePaths, source);
        if (result) {
          eventBus.emit('wiki/file-mapping/names-extracted', {
            spaceSlug,
            extracted: result.extracted ?? [],
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t('errors.failedToExtractNames');
        eventBus.emit('wiki/file-mapping/error', { error: message });
      }
    },
  );

  // Refresh
  eventBus.on('wiki/file-mappings/refresh', async ({ spaceSlug }) => {
    try {
      const service = apiRegistry.getService(FileMappingApiService);
      const result = await service.refresh(spaceSlug);
      eventBus.emit('wiki/file-mappings/refreshed', {
        spaceSlug,
        message: result?.message,
      });
      eventBus.emit('wiki/file-mappings/load', { spaceSlug });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToRefreshFileMappings');
      eventBus.emit('wiki/file-mapping/error', { error: message });
    }
  });

  // Sync
  eventBus.on('wiki/file-mappings/sync', async ({ spaceSlug }) => {
    try {
      const service = apiRegistry.getService(FileMappingApiService);
      const result = await service.sync(spaceSlug);
      eventBus.emit('wiki/file-mappings/synced', {
        spaceSlug,
        message: result?.message,
      });
      eventBus.emit('wiki/file-mappings/load', { spaceSlug });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.failedToSyncFileMappings');
      eventBus.emit('wiki/file-mapping/error', { error: message });
    }
  });
}
