/**
 * Wiki Effects
 *
 * Effects for wiki domain operations (spaces, file tree, navigation).
 * Following flux architecture: Listen to events from actions, call API services, emit results.
 */

import { eventBus, apiRegistry } from '@cyberfabric/react';
import { toLower } from 'lodash';
import { SpacesApiService, TreeNodeType, type TreeNode } from '@/app/api';
import { FileMappingApiService } from '@/app/api/FileMappingApiService';
import { extractErrorMessage } from '@/app/lib/errorMessage';
import { describeError, notify } from '@/app/lib/notify';
import { HttpStatus } from '@/app/lib/httpStatus';
import { t } from '@/app/lib/i18n';

interface UpstreamHtmlError {
  /** Set to a known git-provider status when the HTML body matches one of
   *  the patterns below. Omitted for the generic "looks like HTML" case. */
  status?: HttpStatus;
  message: string;
}

/**
 * Detect an HTML response that the upstream Git provider sent in place of
 * file content (typically a Bitbucket Server / GitHub login page when the
 * service token expired). The backend bubbles the body into `content` with
 * a 200 status, so we have to sniff the payload here instead of relying on
 * an HTTP error.
 *
 * Returns `{ status, message }` when the body looks like an auth/error
 * page, otherwise null. The `message` field is a fallback for the legacy
 * banner; FileViewer uses `status` to render a proper status placeholder.
 */
function detectUpstreamHtmlAuthError(content: string): UpstreamHtmlError | null {
  const head = toLower(content.slice(0, 2048));
  if (!head.startsWith('<!doctype html') && !head.startsWith('<html')) {
    return null;
  }
  if (/\b401\b|unauthorized/.test(head)) {
    return {
      status: HttpStatus.Unauthorized,
      message: t('errors.upstream.unauthorized'),
    };
  }
  if (/\b403\b|forbidden/.test(head)) {
    return {
      status: HttpStatus.Forbidden,
      message: t('errors.upstream.forbidden'),
    };
  }
  if (/\b404\b|not found/.test(head)) {
    return {
      status: HttpStatus.NotFound,
      message: t('errors.upstream.notFound'),
    };
  }
  return {
    message: t('errors.upstream.htmlBody'),
  };
}

export function registerWikiEffects(): void {
  // Load spaces (favorites + recent + all)
  eventBus.on('wiki/spaces/load', async () => {
    try {
      if (!apiRegistry.has(SpacesApiService)) return;
      const spacesService = apiRegistry.getService(SpacesApiService);

      const [favorites, recent, all] = await Promise.all([
        spacesService.listFavorites.fetch({ staleTime: 0 }),
        spacesService.listRecent.fetch({ staleTime: 0 }),
        spacesService.listSpaces.fetch({ staleTime: 0 }),
      ]);

      eventBus.emit('wiki/spaces/loaded', {
        favorites: favorites || [],
        recent: recent || [],
        all: all || [],
      });
    } catch (error) {
      notify.error(
        describeError(error instanceof Error ? error : null, t('errors.failedToLoadSpaces')),
        { dev: true },
      );
    }
  });

  // Select a space — fetch fresh details and mark visited
  eventBus.on('wiki/space/select', async ({ space }) => {
    if (!space?.slug) return;
    try {
      const spacesService = apiRegistry.getService(SpacesApiService);

      const freshSpace = await spacesService.getSpace({ slug: space.slug }).fetch();
      if (freshSpace) {
        eventBus.emit('wiki/space/selected', { space: freshSpace });
      }

      // Mark as visited for recent tracking
      await spacesService.markVisited(space.slug);
    } catch (error) {
      notify.error(
        describeError(error instanceof Error ? error : null, t('errors.failedToSelectSpace')),
        { dev: true },
      );
      eventBus.emit('wiki/space/selected', { space });
    }
  });

  // Toggle favorite
  eventBus.on('wiki/space/toggleFavorite', async ({ spaceSlug, isFavorite }) => {
    try {
      const spacesService = apiRegistry.getService(SpacesApiService);
      if (isFavorite) {
        await spacesService.removeFromFavorites(spaceSlug);
      } else {
        await spacesService.addToFavorites(spaceSlug);
      }
      // Reload spaces to get updated favorites/recent
      eventBus.emit('wiki/spaces/load');
    } catch (error) {
      notify.error(
        describeError(error instanceof Error ? error : null, t('errors.failedToToggleFavorite')),
        { dev: true },
      );
    }
  });

  // Load file tree (via FileMappingApiService — applies mappings). Used for
  // root loads only; subfolders lazy-load via `wiki/git-tree/load` because
  // the wiki tree endpoint currently ignores `path`.
  eventBus.on('wiki/tree/load', async ({ spaceSlug, mode, path }) => {
    try {
      const fmService = apiRegistry.getService(FileMappingApiService);
      const response = await fmService.getTree({ spaceSlug, mode, path });
      if (response) {
        eventBus.emit('wiki/tree/loaded', { tree: response.tree, path });
      }
    } catch (error) {
      eventBus.emit('wiki/tree/error', {
        error: extractErrorMessage(error instanceof Error ? error : null, t('errors.failedToLoadFileTree')),
      });
    }
  });

  // Lazy-load a subtree via git-provider directly — applies no mappings, but
  // returns only the children of the requested folder (the wiki tree
  // endpoint currently ignores `path` and would return root again).
  eventBus.on('wiki/git-tree/load', async ({ space, path }) => {
    try {
      const spacesService = apiRegistry.getService(SpacesApiService);
      const result = await spacesService.getRawTree({
        provider: space.git_provider || '',
        baseUrl: space.git_base_url || '',
        projectKey: space.git_project_key || '',
        repoSlug: space.git_repository_id || '',
        branch: space.git_default_branch || 'main',
        path,
        recursive: false,
      });
      // Normalise raw git-provider entries → TreeNode shape, prepending the
      // parent path when entries arrive as basenames.
      const prefix = path.endsWith('/') ? path : `${path}/`;
      const tree: TreeNode[] = (result ?? []).map((item) => {
        const name = item.name ?? item.path.split('/').pop() ?? item.path;
        const isAbsolute = item.path.startsWith(prefix);
        const fullPath = isAbsolute ? item.path : `${prefix}${item.path}`;
        const type = item.type === 'dir' ? TreeNodeType.Dir : TreeNodeType.File;
        return { name, path: fullPath, type };
      });
      eventBus.emit('wiki/tree/loaded', { tree, path });
    } catch (error) {
      const message = extractErrorMessage(error instanceof Error ? error : null, t('errors.failedToLoadSubtree'));
      eventBus.emit('wiki/tree/error', { error: message });
    }
  });

  // Create space
  eventBus.on('wiki/space/create', async ({ data }) => {
    try {
      const spacesService = apiRegistry.getService(SpacesApiService);
      const space = await spacesService.createSpace.fetch(data);
      if (space) {
        eventBus.emit('wiki/space/created', { space });
        eventBus.emit('wiki/spaces/load');
      }
    } catch (error) {
      eventBus.emit('wiki/space/error', {
        error: extractErrorMessage(error instanceof Error ? error : null, t('errors.failedToCreateSpace')),
      });
    }
  });

  // Update space
  eventBus.on('wiki/space/update', async ({ slug, data }) => {
    try {
      const spacesService = apiRegistry.getService(SpacesApiService);
      const space = await spacesService.updateSpace(slug, data);
      eventBus.emit('wiki/space/updated', { space });
      eventBus.emit('wiki/spaces/load');
    } catch (error) {
      eventBus.emit('wiki/space/error', {
        error: extractErrorMessage(error instanceof Error ? error : null, t('errors.failedToUpdateSpace')),
      });
    }
  });

  // Delete space
  eventBus.on('wiki/space/delete', async ({ slug }) => {
    try {
      const spacesService = apiRegistry.getService(SpacesApiService);
      await spacesService.deleteSpace(slug);
      eventBus.emit('wiki/space/deleted', { slug });
      eventBus.emit('wiki/spaces/load');
    } catch (error) {
      eventBus.emit('wiki/space/error', {
        error: extractErrorMessage(error instanceof Error ? error : null, t('errors.failedToDeleteSpace')),
      });
    }
  });

  // Open file — fetch content via git-provider endpoint, with in-memory cache.
  // Cache is keyed by `space.slug:filePath:branch` so changing branches (or
  // moving between spaces) re-fetches; same path on the same branch is reused.
  const fileContentCache = new Map<string, string>();
  const fileCacheKey = (space: { slug: string; git_default_branch: string }, filePath: string) =>
    `${space.slug}:${space.git_default_branch || 'main'}:${filePath}`;

  // Per-line blame. Cached separately from content because they don't share
  // a server-side path (different endpoints) and the user may toggle blame
  // on/off many times while editing.
  const blameCache = new Map<string, { lines: import('@/app/api').BlameLine[]; supported: boolean }>();
  const blameCacheKey = (
    space: { slug: string; git_default_branch: string },
    filePath: string,
  ) => `${space.slug}:${space.git_default_branch || 'main'}:${filePath}`;

  eventBus.on('wiki/blame/load', async ({ space, filePath }) => {
    const key = blameCacheKey(space, filePath);
    const cached = blameCache.get(key);
    if (cached) {
      eventBus.emit('wiki/blame/loaded', { filePath, ...cached });
      return;
    }
    try {
      const spacesService = apiRegistry.getService(SpacesApiService);
      const result = await spacesService.getFileBlame({
        provider: space.git_provider || '',
        baseUrl: space.git_base_url || '',
        projectKey: space.git_project_key || '',
        repoSlug: space.git_repository_id || '',
        filePath,
        branch: space.git_default_branch || 'main',
        spaceId: space.id,
      });
      const payload = {
        lines: result.lines ?? [],
        supported: !!result.supported,
      };
      blameCache.set(key, payload);
      eventBus.emit('wiki/blame/loaded', { filePath, ...payload });
    } catch (error) {
      eventBus.emit('wiki/blame/error', {
        filePath,
        error: extractErrorMessage(
          error instanceof Error ? error : null,
          t('errors.failedToLoadFileBlame'),
        ),
      });
    }
  });

  eventBus.on('wiki/file/open', async ({ space, filePath }) => {
    const key = fileCacheKey(space, filePath);
    const cached = fileContentCache.get(key);
    if (cached !== undefined) {
      eventBus.emit('wiki/file/loaded', { filePath, content: cached });
      return;
    }
    eventBus.emit('wiki/file/loading', { filePath });
    try {
      const spacesService = apiRegistry.getService(SpacesApiService);
      const result = await spacesService.getFileContent({
        provider: space.git_provider || '',
        baseUrl: space.git_base_url || '',
        projectKey: space.git_project_key || '',
        repoSlug: space.git_repository_id || '',
        filePath,
        branch: space.git_default_branch || 'main',
      });
      const content = result.content || '';
      // Sniff for upstream auth errors that came back as a 200 with an
      // HTML body (Bitbucket Server / GitHub login pages). Surface them as
      // a real error so FileViewer renders the status placeholder instead
      // of dumping the HTML to the user.
      const upstreamAuthError = detectUpstreamHtmlAuthError(content);
      if (upstreamAuthError) {
        eventBus.emit('wiki/file/error', {
          filePath,
          error: upstreamAuthError.message,
          status: upstreamAuthError.status,
        });
        return;
      }
      fileContentCache.set(key, content);
      eventBus.emit('wiki/file/loaded', { filePath, content });
    } catch (error) {
      eventBus.emit('wiki/file/error', {
        filePath,
        error: extractErrorMessage(error instanceof Error ? error : null, t('errors.failedToLoadFileContent')),
      });
    }
  });

  // Invalidate file cache when a draft is saved/discarded/committed
  eventBus.on('wiki/draft/saved', () => {
    fileContentCache.clear();
  });
  eventBus.on('wiki/draft/committed', () => {
    fileContentCache.clear();
  });
  eventBus.on('wiki/draft/discarded', () => {
    fileContentCache.clear();
  });

  // Navigate — update hash
  eventBus.on('wiki/navigate', ({ hash }) => {
    window.location.hash = hash;
  });

  // PRs — load open pull requests with optional author/reviewer filter
  eventBus.on('wiki/my-reviews/load', async ({ author, reviewer }) => {
    try {
      if (!apiRegistry.has(SpacesApiService)) return;
      const service = apiRegistry.getService(SpacesApiService);
      const data = await service.getPullRequests({ author, reviewer });
      eventBus.emit('wiki/my-reviews/loaded', {
        pullRequests: data.pull_requests || [],
        currentGitUsernames: data.current_git_usernames || [],
      });
    } catch (error) {
      const message = extractErrorMessage(
        error instanceof Error ? error : null,
        t('errors.failedToLoadPullRequests'),
      );
      notify.error(message, { dev: true });
      eventBus.emit('wiki/my-reviews/error', { error: message });
    }
  });
}
