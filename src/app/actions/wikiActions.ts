/**
 * Wiki Actions
 *
 * Actions for wiki domain operations (spaces, file tree, navigation).
 * Following flux architecture: Actions emit events, Effects listen and dispatch.
 */

import { eventBus } from '@cyberfabric/react';
import type { Space, ViewMode, CreateSpaceRequest, UpdateSpaceRequest } from '@/app/api';

export function loadSpaces(): void {
  eventBus.emit('wiki/spaces/load');
}

export function selectSpace(space: Space): void {
  eventBus.emit('wiki/space/select', { space });
}

export function toggleFavorite(spaceSlug: string, isFavorite: boolean): void {
  eventBus.emit('wiki/space/toggleFavorite', { spaceSlug, isFavorite });
}

export function createSpace(data: CreateSpaceRequest): void {
  eventBus.emit('wiki/space/create', { data });
}

export function updateSpace(slug: string, data: UpdateSpaceRequest): void {
  eventBus.emit('wiki/space/update', { slug, data });
}

export function deleteSpace(slug: string): void {
  eventBus.emit('wiki/space/delete', { slug });
}

export function loadFileTree(spaceSlug: string, mode: ViewMode, path?: string): void {
  eventBus.emit('wiki/tree/load', { spaceSlug, mode, path });
}

export function loadGitSubtree(space: Space, path: string): void {
  eventBus.emit('wiki/git-tree/load', { space, path });
}

export function openFile(space: Space, filePath: string): void {
  eventBus.emit('wiki/file/open', { space, filePath });
}

export function navigateTo(hash: string): void {
  eventBus.emit('wiki/navigate', { hash });
}

export function loadPullRequests(opts: { author?: string; reviewer?: string } = {}): void {
  eventBus.emit('wiki/my-reviews/load', opts);
}
