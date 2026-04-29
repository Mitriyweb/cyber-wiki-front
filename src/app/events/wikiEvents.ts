/**
 * Wiki Events
 * Event type declarations for wiki domain (spaces, file trees, navigation)
 */

import '@cyberfabric/react';
import type {
  Space,
  UserSpacePreference,
  TreeNode,
  ViewMode,
  CreateSpaceRequest,
  UpdateSpaceRequest,
  MyReviewPR,
} from '@/app/api';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Load spaces (favorites, recent, all) */
    'wiki/spaces/load': void;
    /** Spaces loaded */
    'wiki/spaces/loaded': {
      favorites: UserSpacePreference[];
      recent: UserSpacePreference[];
      all: Space[];
    };
    /** Select a space */
    'wiki/space/select': { space: Space };
    /** Space selected and details loaded */
    'wiki/space/selected': { space: Space };
    /** Toggle favorite for a space */
    'wiki/space/toggleFavorite': { spaceSlug: string; isFavorite: boolean };
    /** Create a new space */
    'wiki/space/create': { data: CreateSpaceRequest };
    /** Space created successfully */
    'wiki/space/created': { space: Space };
    /** Update a space */
    'wiki/space/update': { slug: string; data: UpdateSpaceRequest };
    /** Space updated successfully */
    'wiki/space/updated': { space: Space };
    /** Delete a space */
    'wiki/space/delete': { slug: string };
    /** Space deleted */
    'wiki/space/deleted': { slug: string };
    /** Space operation error */
    'wiki/space/error': { error: string };
    /** Load file tree for a space (path = '' loads root, otherwise lazy-loads children of that folder) */
    'wiki/tree/load': { spaceSlug: string; mode: ViewMode; path?: string };
    /** Lazy-load a subtree directly via git-provider (skips file-mapping; works without backend support for `path` in the wiki tree endpoint) */
    'wiki/git-tree/load': { space: Space; path: string };
    /** File tree loaded — `path` echoed back so consumers can splice children into the existing tree */
    'wiki/tree/loaded': { tree: TreeNode[]; path?: string };
    /** File tree load error */
    'wiki/tree/error': { error: string };
    /** Navigate to a file */
    'wiki/file/open': { space: Space; filePath: string };
    /** File content loading */
    'wiki/file/loading': { filePath: string };
    /** File content loaded */
    'wiki/file/loaded': { filePath: string; content: string };
    /** File content load error */
    'wiki/file/error': { filePath: string; error: string };
    /** Navigate hash route */
    'wiki/navigate': { hash: string };
    /** Load PRs (optionally filtered by author/reviewer) */
    'wiki/my-reviews/load': { author?: string; reviewer?: string };
    /** My reviews loaded */
    'wiki/my-reviews/loaded': { pullRequests: MyReviewPR[]; currentGitUsernames: string[] };
    /** My reviews load error */
    'wiki/my-reviews/error': { error: string };
  }
}
