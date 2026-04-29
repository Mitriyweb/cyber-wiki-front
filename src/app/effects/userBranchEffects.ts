/**
 * User Branch Effects
 *
 * Effects for user-branch domain (workspace, task lifecycle, PR ops, rebase).
 * Per FR cpt-cyberwiki-fr-save-commit.
 */

import { eventBus, apiRegistry } from '@cyberfabric/react';
import { UserBranchApiService } from '@/app/api/UserBranchApiService';

export function registerUserBranchEffects(): void {
  // Load workspace overview
  eventBus.on('wiki/workspace/load', async ({ spaceId }) => {
    try {
      if (!apiRegistry.has(UserBranchApiService)) return;
      const service = apiRegistry.getService(UserBranchApiService);
      const workspace = await service.getWorkspace({ spaceId }).fetch();
      if (workspace) {
        eventBus.emit('wiki/workspace/loaded', { spaceId, workspace });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load workspace';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Create task
  eventBus.on('wiki/task/create', async ({ spaceId, name }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      const task = await service.createTask.fetch({ space_id: spaceId, name });
      if (task) {
        eventBus.emit('wiki/task/created', { task });
        eventBus.emit('wiki/workspace/load', { spaceId });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create task';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Select task
  eventBus.on('wiki/task/select', async ({ branchId }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      await service.selectTask.fetch({ branch_id: branchId });
      eventBus.emit('wiki/task/selected', { branchId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select task';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Rename task
  eventBus.on('wiki/task/rename', async ({ branchId, name }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      const task = await service.renameTask.fetch({ branch_id: branchId, name });
      if (task) {
        eventBus.emit('wiki/task/renamed', { task });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename task';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Delete task
  eventBus.on('wiki/task/delete', async ({ branchId }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      const result = await service.deleteTask.fetch({ branch_id: branchId });
      if (result?.deleted) {
        eventBus.emit('wiki/task/deleted', {
          branchId,
          branchName: result.branch_name,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete task';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Create pull request
  eventBus.on('wiki/pr/create', async ({ spaceId, branchId, title, description }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      const result = await service.createPullRequest.fetch({
        space_id: spaceId,
        branch_id: branchId,
        title,
        description,
      });
      if (result) {
        eventBus.emit('wiki/pr/created', { result });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create pull request';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Delete pull request
  eventBus.on('wiki/pr/delete', async ({ spaceId, branchId }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      const result = await service.deletePr.fetch({ space_id: spaceId, branch_id: branchId });
      if (result?.deleted) {
        eventBus.emit('wiki/pr/deleted', { branchName: result.branch_name });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete pull request';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Unstage branch
  eventBus.on('wiki/branch/unstage', async ({ spaceId, branchId }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      const result = await service.unstageBranch.fetch({ space_id: spaceId, branch_id: branchId });
      if (result) {
        eventBus.emit('wiki/branch/unstaged', {
          branchName: result.branch_name,
          unstagedFiles: result.unstaged_files,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unstage branch';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Rebase branch
  eventBus.on('wiki/branch/rebase', async ({ spaceId, branchId }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      const result = await service.rebaseBranch.fetch({ space_id: spaceId, branch_id: branchId });
      if (result?.rebased) {
        eventBus.emit('wiki/branch/rebased', { branchName: result.branch_name });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rebase branch';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });

  // Discard branch
  eventBus.on('wiki/branch/discard', async ({ spaceId, branchId }) => {
    try {
      const service = apiRegistry.getService(UserBranchApiService);
      const result = await service.discardBranch.fetch({ space_id: spaceId, branch_id: branchId });
      if (result?.discarded) {
        eventBus.emit('wiki/branch/discarded', { branchName: result.branch_name });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to discard branch';
      eventBus.emit('wiki/branch/error', { error: message });
    }
  });
}
