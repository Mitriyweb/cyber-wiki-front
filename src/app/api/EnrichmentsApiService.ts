/**
 * Enrichments Domain - API Service
 * Service for enrichments and comments.
 * Connected to real Django backend via /api/enrichments/v1/ and /api/wiki/v1/comments/.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type {
  EnrichmentsResponse,
  CommentData,
} from './wikiTypes';
import { EnrichmentType } from './wikiTypes';

export class EnrichmentsApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api' }, restProtocol, restEndpoints);
  }

  // Enrichments (query by source_uri)
  async getEnrichments(
    sourceUri: string,
    options: { recursive?: boolean } = {},
  ): Promise<EnrichmentsResponse> {
    const params = new URLSearchParams({ source_uri: sourceUri });
    if (options.recursive) {
      params.set('recursive', 'true');
    }
    return this.protocol(RestProtocol).get<EnrichmentsResponse>(
      `/enrichments/v1/enrichments/?${params.toString()}`,
    );
  }

  // Enrichments filtered by type
  async getEnrichmentsByType(
    sourceUri: string,
    type: EnrichmentType,
  ): Promise<EnrichmentsResponse> {
    const params = new URLSearchParams({ source_uri: sourceUri, type });
    return this.protocol(RestProtocol).get<EnrichmentsResponse>(
      `/enrichments/v1/enrichments/?${params.toString()}`,
    );
  }

  // List available enrichment types
  async getEnrichmentTypes(): Promise<string[]> {
    const response = await this.protocol(RestProtocol).get<{ types: string[] }>(
      '/enrichments/v1/enrichments/types/',
    );
    return response.types;
  }

  // streamEnrichments (SSE) — TODO P3+: requires raw fetch + ReadableStream,
  // not currently expressible via RestProtocol. Skipped for now.

  // Comments CRUD (via wiki API)
  async listComments(sourceUri: string): Promise<CommentData[]> {
    return this.protocol(RestProtocol).get<CommentData[]>(
      `/wiki/v1/comments/?source_uri=${encodeURIComponent(sourceUri)}`
    );
  }

  /** All accessible comments (no source_uri filter). For the global "all
   *  comments" view. Backend returns root comments only; replies are nested. */
  async listAllComments(opts: { isResolved?: boolean } = {}): Promise<CommentData[]> {
    const params = new URLSearchParams();
    if (opts.isResolved !== undefined) {
      params.set('is_resolved', opts.isResolved ? 'true' : 'false');
    }
    const qs = params.toString();
    return this.protocol(RestProtocol).get<CommentData[]>(
      `/wiki/v1/comments/${qs ? `?${qs}` : ''}`,
    );
  }

  async createComment(payload: {
    source_uri: string;
    text: string;
    line_start?: number;
    line_end?: number;
    parent_comment?: string;
  }): Promise<CommentData> {
    return this.protocol(RestProtocol).post<CommentData, typeof payload>(
      '/wiki/v1/comments/', payload
    );
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.protocol(RestProtocol).delete(`/wiki/v1/comments/${commentId}/`);
  }

  async resolveComment(commentId: string): Promise<CommentData> {
    return this.protocol(RestProtocol).post<CommentData>(
      `/wiki/v1/comments/${commentId}/resolve/`
    );
  }

  async unresolveComment(commentId: string): Promise<CommentData> {
    return this.protocol(RestProtocol).post<CommentData>(
      `/wiki/v1/comments/${commentId}/unresolve/`
    );
  }
}
