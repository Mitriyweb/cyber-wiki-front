/**
 * File Mapping Domain - API Service
 *
 * Per-space file mappings (display name, icon, sort order, visibility).
 * Drives Document View and File Tree View navigation
 * (FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction).
 *
 * Connected to /api/wiki/v1/spaces/{slug}/file-mappings/.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type {
  ExtractNameSource,
  ExtractNamesResponse,
  FileMapping,
  FileMappingCreate,
  FileTreeResponse,
  ViewMode,
} from './wikiTypes';

export class FileMappingApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api/wiki/v1' }, restProtocol, restEndpoints);
  }

  // List mappings for a space
  async list(spaceSlug: string): Promise<FileMapping[]> {
    return this.protocol(RestProtocol).get<FileMapping[]>(
      `/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/`,
    );
  }

  // Create
  async create(spaceSlug: string, data: FileMappingCreate): Promise<FileMapping> {
    return this.protocol(RestProtocol).post<FileMapping, FileMappingCreate>(
      `/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/`,
      data,
    );
  }

  // Update (PUT — same shape as create, partial allowed)
  async update(
    spaceSlug: string,
    id: string,
    data: Partial<FileMappingCreate>,
  ): Promise<FileMapping> {
    return this.protocol(RestProtocol).put<FileMapping, Partial<FileMappingCreate>>(
      `/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/${encodeURIComponent(id)}/`,
      data,
    );
  }

  // Delete
  async delete(spaceSlug: string, id: string): Promise<void> {
    await this.protocol(RestProtocol).delete(
      `/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/${encodeURIComponent(id)}/`,
    );
  }

  // Bulk update
  async bulkUpdate(
    spaceSlug: string,
    mappings: FileMappingCreate[],
  ): Promise<FileMapping[]> {
    return this.protocol(RestProtocol).post<
      FileMapping[],
      { mappings: FileMappingCreate[] }
    >(
      `/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/bulk_update/`,
      { mappings },
    );
  }

  // Apply rule to a folder (and optionally its children)
  async applyFolderRule(
    spaceSlug: string,
    folderPath: string,
    rule: Partial<FileMappingCreate>,
    applyToChildren = true,
  ): Promise<FileMapping> {
    return this.protocol(RestProtocol).post<
      FileMapping,
      {
        folder_path: string;
        apply_to_children: boolean;
        rule: Partial<FileMappingCreate>;
      }
    >(`/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/apply_folder_rule/`, {
      folder_path: folderPath,
      apply_to_children: applyToChildren,
      rule,
    });
  }

  // Extract display names from file contents
  async extractNames(
    spaceSlug: string,
    filePaths: string[],
    source: ExtractNameSource,
  ): Promise<ExtractNamesResponse> {
    return this.protocol(RestProtocol).post<
      ExtractNamesResponse,
      { file_paths: string[]; source: ExtractNameSource }
    >(`/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/extract_names/`, {
      file_paths: filePaths,
      source,
    });
  }

  // Refresh — re-extract display names from file contents
  async refresh(spaceSlug: string): Promise<{ message?: string }> {
    return this.protocol(RestProtocol).post<{ message?: string }>(
      `/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/refresh/`,
    );
  }

  // Sync — drop mappings for deleted files, recompute effective values
  async sync(spaceSlug: string): Promise<{ message?: string }> {
    return this.protocol(RestProtocol).post<{ message?: string }>(
      `/spaces/${encodeURIComponent(spaceSlug)}/file-mappings/sync/`,
    );
  }

  // Get file tree with mappings applied (replaces SpacesApiService.getFileTree;
  // adds filters and path support)
  async getTree(params: {
    spaceSlug: string;
    mode?: ViewMode;
    filters?: string[];
    path?: string;
  }): Promise<FileTreeResponse> {
    const search = new URLSearchParams();
    if (params.mode) search.set('mode', params.mode);
    if (params.filters && params.filters.length > 0) {
      search.set('filters', params.filters.join(','));
    }
    if (params.path) search.set('path', params.path);
    const qs = search.toString();
    return this.protocol(RestProtocol).get<FileTreeResponse>(
      `/spaces/${encodeURIComponent(params.spaceSlug)}/file-mappings/get_tree/${qs ? `?${qs}` : ''}`,
    );
  }
}
