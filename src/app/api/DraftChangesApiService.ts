/**
 * Draft Changes Domain - API Service
 *
 * Manages user draft edits (not yet committed to git).
 * Connected to Django backend via /api/wiki/v1/draft-changes/.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type {
  DraftChange,
  DraftChangeListItem,
  SaveDraftChangeRequest,
  SaveDraftChangeResponse,
  CommitDraftChangesRequest,
  CommitDraftChangesResult,
} from './wikiTypes';

export class DraftChangesApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api/wiki/v1' }, restProtocol, restEndpoints);
  }

  // List drafts (imperative — no cache so post-commit reloads see the
  // authoritative state instead of a stale TanStack snapshot).
  async listAll(): Promise<DraftChangeListItem[]> {
    return this.protocol(RestProtocol).get<DraftChangeListItem[]>(
      '/draft-changes/',
    );
  }

  async listForSpace(params: { spaceId: string }): Promise<DraftChangeListItem[]> {
    return this.protocol(RestProtocol).get<DraftChangeListItem[]>(
      `/draft-changes/?space_id=${encodeURIComponent(params.spaceId)}`,
    );
  }

  // Get one draft (declarative)
  readonly getById = this.protocol(RestEndpointProtocol)
    .queryWith<DraftChange, { changeId: string }>(
      (p) => `/draft-changes/${encodeURIComponent(p.changeId)}/`,
    );

  // Create / upsert draft
  readonly save = this.protocol(RestEndpointProtocol)
    .mutation<SaveDraftChangeResponse, SaveDraftChangeRequest>(
      'POST',
      '/draft-changes/',
    );

  // Commit selected drafts to git
  readonly commit = this.protocol(RestEndpointProtocol)
    .mutation<CommitDraftChangesResult, CommitDraftChangesRequest>(
      'POST',
      '/draft-changes/commit/',
    );

  // Discard one draft (imperative — dynamic path)
  async discard(changeId: string): Promise<void> {
    await this.protocol(RestProtocol).delete(
      `/draft-changes/${encodeURIComponent(changeId)}/`,
    );
  }
}
