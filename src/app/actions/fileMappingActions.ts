/**
 * File Mapping Actions
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 */

import { eventBus } from '@cyberfabric/react';
import type {
  ExtractNameSource,
  FileMappingCreate,
} from '@/app/api';

export function loadFileMappings(spaceSlug: string): void {
  eventBus.emit('wiki/file-mappings/load', { spaceSlug });
}

export function createFileMapping(spaceSlug: string, data: FileMappingCreate): void {
  eventBus.emit('wiki/file-mapping/create', { spaceSlug, data });
}

export function updateFileMapping(
  spaceSlug: string,
  id: string,
  data: Partial<FileMappingCreate>,
): void {
  eventBus.emit('wiki/file-mapping/update', { spaceSlug, id, data });
}

export function deleteFileMapping(spaceSlug: string, id: string): void {
  eventBus.emit('wiki/file-mapping/delete', { spaceSlug, id });
}

export function bulkUpdateFileMappings(
  spaceSlug: string,
  mappings: FileMappingCreate[],
): void {
  eventBus.emit('wiki/file-mappings/bulk-update', { spaceSlug, mappings });
}

export function applyFolderRule(payload: {
  spaceSlug: string;
  folderPath: string;
  rule: Partial<FileMappingCreate>;
  applyToChildren?: boolean;
}): void {
  eventBus.emit('wiki/file-mapping/apply-folder-rule', {
    spaceSlug: payload.spaceSlug,
    folderPath: payload.folderPath,
    rule: payload.rule,
    applyToChildren: payload.applyToChildren ?? true,
  });
}

export function extractNames(
  spaceSlug: string,
  filePaths: string[],
  source: ExtractNameSource,
): void {
  eventBus.emit('wiki/file-mapping/extract-names', { spaceSlug, filePaths, source });
}

export function refreshFileMappings(spaceSlug: string): void {
  eventBus.emit('wiki/file-mappings/refresh', { spaceSlug });
}

export function syncFileMappings(spaceSlug: string): void {
  eventBus.emit('wiki/file-mappings/sync', { spaceSlug });
}
