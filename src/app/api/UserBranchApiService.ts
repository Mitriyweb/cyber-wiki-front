/**
 * User Branch Domain - API Service
 *
 * Per-user task branches for the GitHub-style review workflow.
 * Connected to Django backend via /api/wiki/v1/user-branch/.
 * Per FR cpt-cyberwiki-fr-save-commit.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type {
  UserTaskInfo,
  WorkspaceResponse,
  CreatePrResult,
} from './wikiTypes';

export class UserBranchApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api/wiki/v1' }, restProtocol, restEndpoints);
  }

  // Workspace overview (all tasks for a space)
  readonly getWorkspace = this.protocol(RestEndpointProtocol)
    .queryWith<WorkspaceResponse, { spaceId: string }>(
      (p) => `/user-branch/workspace/?space_id=${encodeURIComponent(p.spaceId)}`,
    );

  // Task lifecycle
  readonly createTask = this.protocol(RestEndpointProtocol)
    .mutation<UserTaskInfo, { space_id: string; name: string }>(
      'POST',
      '/user-branch/create-task/',
    );

  readonly selectTask = this.protocol(RestEndpointProtocol)
    .mutation<{ selected_task_id: string }, { branch_id: string }>(
      'POST',
      '/user-branch/select-task/',
    );

  readonly deleteTask = this.protocol(RestEndpointProtocol)
    .mutation<{ deleted: boolean; branch_name: string }, { branch_id: string }>(
      'POST',
      '/user-branch/delete-task/',
    );

  readonly renameTask = this.protocol(RestEndpointProtocol)
    .mutation<UserTaskInfo, { branch_id: string; name: string }>(
      'POST',
      '/user-branch/rename-task/',
    );

  // Per-task actions (branch_id optional, defaults to selected)
  readonly createPullRequest = this.protocol(RestEndpointProtocol)
    .mutation<CreatePrResult, {
      space_id: string;
      branch_id?: string;
      title?: string;
      description?: string;
    }>('POST', '/user-branch/create-pr/');

  readonly discardBranch = this.protocol(RestEndpointProtocol)
    .mutation<{ discarded: boolean; branch_name: string }, {
      space_id: string;
      branch_id?: string;
    }>('POST', '/user-branch/discard/');

  readonly unstageBranch = this.protocol(RestEndpointProtocol)
    .mutation<{ unstaged_files: string[]; branch_name: string }, {
      space_id: string;
      branch_id?: string;
    }>('POST', '/user-branch/unstage/');

  readonly rebaseBranch = this.protocol(RestEndpointProtocol)
    .mutation<{ rebased: boolean; branch_name: string }, {
      space_id: string;
      branch_id?: string;
    }>('POST', '/user-branch/rebase/');

  readonly deletePr = this.protocol(RestEndpointProtocol)
    .mutation<{ deleted: boolean; branch_name: string }, {
      space_id: string;
      branch_id?: string;
    }>('POST', '/user-branch/delete-pr/');
}
