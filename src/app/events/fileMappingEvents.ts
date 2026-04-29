/**
 * File Mapping Events
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 */

import '@cyberfabric/react';
import type {
  ExtractedName,
  ExtractNameSource,
  FileMapping,
  FileMappingCreate,
} from '@/app/api';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Load all file mappings for a space */
    'wiki/file-mappings/load': { spaceSlug: string };
    /** File mappings loaded */
    'wiki/file-mappings/loaded': { spaceSlug: string; mappings: FileMapping[] };

    /** Create a new mapping */
    'wiki/file-mapping/create': { spaceSlug: string; data: FileMappingCreate };
    /** Mapping created */
    'wiki/file-mapping/created': { spaceSlug: string; mapping: FileMapping };

    /** Update a mapping */
    'wiki/file-mapping/update': {
      spaceSlug: string;
      id: string;
      data: Partial<FileMappingCreate>;
    };
    /** Mapping updated */
    'wiki/file-mapping/updated': { spaceSlug: string; mapping: FileMapping };

    /** Delete a mapping */
    'wiki/file-mapping/delete': { spaceSlug: string; id: string };
    /** Mapping deleted */
    'wiki/file-mapping/deleted': { spaceSlug: string; id: string };

    /** Bulk-update mappings (replaces full set) */
    'wiki/file-mappings/bulk-update': {
      spaceSlug: string;
      mappings: FileMappingCreate[];
    };
    /** Bulk update applied */
    'wiki/file-mappings/bulk-updated': {
      spaceSlug: string;
      mappings: FileMapping[];
    };

    /** Apply rule to a folder */
    'wiki/file-mapping/apply-folder-rule': {
      spaceSlug: string;
      folderPath: string;
      rule: Partial<FileMappingCreate>;
      applyToChildren: boolean;
    };
    /** Folder rule applied */
    'wiki/file-mapping/folder-rule-applied': {
      spaceSlug: string;
      mapping: FileMapping;
    };

    /** Extract display names from files */
    'wiki/file-mapping/extract-names': {
      spaceSlug: string;
      filePaths: string[];
      source: ExtractNameSource;
    };
    /** Names extracted */
    'wiki/file-mapping/names-extracted': {
      spaceSlug: string;
      extracted: ExtractedName[];
    };

    /** Refresh — re-extract display names from file contents */
    'wiki/file-mappings/refresh': { spaceSlug: string };
    /** Refresh complete */
    'wiki/file-mappings/refreshed': { spaceSlug: string; message?: string };

    /** Sync — drop mappings for deleted files, recompute effective values */
    'wiki/file-mappings/sync': { spaceSlug: string };
    /** Sync complete */
    'wiki/file-mappings/synced': { spaceSlug: string; message?: string };

    /** File-mapping operation error */
    'wiki/file-mapping/error': { error: string };
  }
}
