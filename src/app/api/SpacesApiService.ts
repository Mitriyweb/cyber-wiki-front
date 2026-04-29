/**
 * Spaces Domain - API Service
 * Service for wiki spaces, file trees, and user preferences.
 * Connected to real Django backend via /api/wiki/v1/ endpoints.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type {
  Space,
  UserSpacePreference,
  CreateSpaceRequest,
  UpdateSpaceRequest,
  MyReviewsResponse,
} from './wikiTypes';

export class SpacesApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api/wiki/v1' }, restProtocol, restEndpoints);
  }

  // Space CRUD (declarative endpoints)
  readonly listSpaces = this.protocol(RestEndpointProtocol)
    .query<Space[]>('/spaces/');

  readonly getSpace = this.protocol(RestEndpointProtocol)
    .queryWith<Space, { slug: string }>((p) => `/spaces/${p.slug}/`);

  readonly createSpace = this.protocol(RestEndpointProtocol)
    .mutation<Space, CreateSpaceRequest>('POST', '/spaces/');

  // User Preferences (declarative)
  readonly listFavorites = this.protocol(RestEndpointProtocol)
    .query<UserSpacePreference[]>('/preferences/favorites/');

  readonly listRecent = this.protocol(RestEndpointProtocol)
    .query<UserSpacePreference[]>('/preferences/recent/?limit=10');

  // User Preferences (imperative — dynamic paths not supported by mutation descriptor)
  async addToFavorites(spaceSlug: string): Promise<UserSpacePreference> {
    return this.protocol(RestProtocol).post<UserSpacePreference>(
      `/preferences/favorites/${spaceSlug}/`
    );
  }

  async removeFromFavorites(spaceSlug: string): Promise<void> {
    await this.protocol(RestProtocol).delete(`/preferences/favorites/${spaceSlug}/`);
  }

  async markVisited(spaceSlug: string): Promise<UserSpacePreference> {
    return this.protocol(RestProtocol).post<UserSpacePreference>(
      `/preferences/visited/${spaceSlug}/`
    );
  }

  // Space update / delete (imperative — dynamic paths)
  async updateSpace(slug: string, data: UpdateSpaceRequest): Promise<Space> {
    return this.protocol(RestProtocol).patch<Space, UpdateSpaceRequest>(
      `/spaces/${slug}/`, data
    );
  }

  async deleteSpace(slug: string): Promise<void> {
    await this.protocol(RestProtocol).delete(`/spaces/${slug}/`);
  }

  // Raw subtree (via git-provider API) — bypasses file-mapping so it can lazy-load
  // subfolders (the wiki get_tree endpoint only returns the root).
  async getRawTree(params: {
    provider: string;
    baseUrl: string;
    projectKey: string;
    repoSlug: string;
    branch: string;
    path?: string;
    recursive?: boolean;
  }): Promise<Array<{ path: string; type: string; name?: string }>> {
    let projectKey = params.projectKey;
    let repoSlug = params.repoSlug;
    if (!projectKey && repoSlug.includes('/')) {
      const parts = repoSlug.split('/');
      projectKey = parts[0];
      repoSlug = parts.slice(1).join('/');
    }
    const qs = new URLSearchParams({
      provider: params.provider,
      base_url: params.baseUrl,
      project_key: projectKey,
      repo_slug: repoSlug,
      branch: params.branch,
      recursive: params.recursive ? 'true' : 'false',
    });
    if (params.path) qs.append('path', params.path);
    return this.protocol(RestProtocol).get<Array<{ path: string; type: string; name?: string }>>(
      `../../git-provider/v1/tree?${qs.toString()}`,
    );
  }

  // File content (via git-provider API)
  async getFileContent(params: {
    provider: string;
    baseUrl: string;
    projectKey: string;
    repoSlug: string;
    filePath: string;
    branch: string;
  }): Promise<{ content: string }> {
    let projectKey = params.projectKey;
    let repoSlug = params.repoSlug;

    // GitHub stores owner/repo in repoSlug; split when projectKey is empty
    if (!projectKey && repoSlug.includes('/')) {
      const parts = repoSlug.split('/');
      projectKey = parts[0];
      repoSlug = parts.slice(1).join('/');
    }

    const qs = new URLSearchParams({
      provider: params.provider,
      base_url: params.baseUrl,
      project_key: projectKey,
      repo_slug: repoSlug,
      file_path: params.filePath,
      branch: params.branch,
    });
    return this.protocol(RestProtocol).get<{ content: string }>(
      `../../git-provider/v1/file/?${qs.toString()}`
    );
  }

  // PRs across all visible spaces with optional author/reviewer filters
  async getPullRequests(opts: { author?: string; reviewer?: string } = {}): Promise<MyReviewsResponse> {
    const params = new URLSearchParams();
    if (opts.author) params.set('author', opts.author);
    if (opts.reviewer) params.set('reviewer', opts.reviewer);
    const qs = params.toString();
    return this.protocol(RestProtocol).get<MyReviewsResponse>(`/my-reviews/${qs ? `?${qs}` : ''}`);
  }
}
