/**
 * User Branch Events
 *
 * Event type declarations for user-branch domain (per-user task branches, PR ops).
 * Per FR cpt-cyberwiki-fr-save-commit.
 */

import '@cyberfabric/react';
import type {
  UserTaskInfo,
  WorkspaceResponse,
  CreatePrResult,
} from '@/app/api';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Load workspace for a space */
    'wiki/workspace/load': { spaceId: string };
    /** Workspace loaded */
    'wiki/workspace/loaded': { spaceId: string; workspace: WorkspaceResponse };

    /** Create a new task */
    'wiki/task/create': { spaceId: string; name: string };
    /** Task created */
    'wiki/task/created': { task: UserTaskInfo };

    /** Select a task as the active one */
    'wiki/task/select': { branchId: string };
    /** Task selected */
    'wiki/task/selected': { branchId: string };

    /** Rename a task */
    'wiki/task/rename': { branchId: string; name: string };
    /** Task renamed */
    'wiki/task/renamed': { task: UserTaskInfo };

    /** Delete a task */
    'wiki/task/delete': { branchId: string };
    /** Task deleted */
    'wiki/task/deleted': { branchId: string; branchName: string };

    /** Create a pull request from a branch */
    'wiki/pr/create': {
      spaceId: string;
      branchId?: string;
      title?: string;
      description?: string;
    };
    /** Pull request created */
    'wiki/pr/created': { result: CreatePrResult };
    /** Delete (close/abandon) a pull request */
    'wiki/pr/delete': { spaceId: string; branchId?: string };
    /** Pull request deleted */
    'wiki/pr/deleted': { branchName: string };

    /** Unstage a branch (move staged drafts back to drafts) */
    'wiki/branch/unstage': { spaceId: string; branchId?: string };
    /** Branch unstaged */
    'wiki/branch/unstaged': { branchName: string; unstagedFiles: string[] };

    /** Rebase a branch onto its base */
    'wiki/branch/rebase': { spaceId: string; branchId?: string };
    /** Branch rebased */
    'wiki/branch/rebased': { branchName: string };

    /** Discard a branch (drop all changes) */
    'wiki/branch/discard': { spaceId: string; branchId?: string };
    /** Branch discarded */
    'wiki/branch/discarded': { branchName: string };

    /** Branch / task / PR operation error */
    'wiki/branch/error': { error: string };
  }
}
