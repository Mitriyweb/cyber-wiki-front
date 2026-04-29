/**
 * SpaceViewPage
 *
 * Space content viewer — file tree sidebar with dual mode (dev/documents)
 * and file content area. Ported from doclab MainView + SpaceTree.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { eventBus } from '@cyberfabric/react';
import {
  FolderOpen,
  File,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  Eye,
  Code,
  ArrowLeft,
  FilePlus,
  ChevronsDownUp,
  ChevronsUpDown,
  Layers,
  PanelRightClose,
} from 'lucide-react';
import { EnrichmentPanel } from '@/app/components/enrichments/EnrichmentPanel';
import {
  loadSpaces,
  selectSpace,
  loadFileTree,
  loadGitSubtree,
  openFile,
} from '@/app/actions/wikiActions';
import { loadComments } from '@/app/actions/enrichmentActions';
import { loadDrafts } from '@/app/actions/draftChangeActions';
import {
  FileViewMode,
  Urls,
  type Space,
  type TreeNode,
  ViewMode,
  buildSourceUri,
} from '@/app/api';
import FileViewer from '@/app/components/file/FileViewer';
import { CreateFileModal } from '@/app/components/file/CreateFileModal';

function collectAllDirPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === 'dir' && node.children && node.children.length > 0) {
      paths.push(node.path);
      paths.push(...collectAllDirPaths(node.children));
    }
  }
  return paths;
}

interface SpaceViewPageProps {
  navigate: (view: string) => void;
}

const SpaceViewPage: React.FC<SpaceViewPageProps> = ({ navigate }) => {
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Documents);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnrichments, setShowEnrichments] = useState(false);
  const [selectedLines, setSelectedLines] = useState<{ start: number; end: number } | null>(null);
  /** A deep-linked file path that we still need to auto-expand parent folders
   *  for. Cleared once every ancestor along the path has been expanded. */
  const [pendingExpandPath, setPendingExpandPath] = useState<string | null>(null);
  // Preserved across file navigation so picking Source on one file keeps the
  // next file in Source too (only meaningful for markdown).
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>(FileViewMode.Preview);
  const [commentsCount, setCommentsCount] = useState(0);
  /** Lines that have at least one comment anchored to them in the current
   *  file — passed down to FileViewer for the gutter marker. */
  const [commentLines, setCommentLines] = useState<Set<number>>(new Set());
  /** Tree sidebar visibility — toggled from the FileViewer header so the user
   *  can reclaim horizontal space when reading. */
  const [showTree, setShowTree] = useState(true);
  /** Open state for the GitHub-style "create new file in repo" dialog. */
  const [showCreateFile, setShowCreateFile] = useState(false);
  /** Override source_uri from deep-link (e.g. CommentsPage passes the
   *  original URI when the space's git_project_key has changed). */
  const [overrideSourceUri, setOverrideSourceUri] = useState<string | null>(null);
  /** Maps file_path → draft_id for the current space (pending drafts). */
  const [draftsByPath, setDraftsByPath] = useState<Map<string, string>>(new Map());
  /** Convenience set of paths with pending drafts (drives tree dot + header badge). */
  const draftPaths = useMemo(() => new Set(draftsByPath.keys()), [draftsByPath]);

  // Load spaces on mount
  useEffect(() => {
    const sub = eventBus.on('wiki/spaces/loaded', (payload) => {
      setAllSpaces(payload.all);
      setLoading(false);

      // Auto-select space from URL
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const spaceSlug = urlParams.get('space');
      if (spaceSlug) {
        const space = payload.all.find((s) => s.slug === spaceSlug);
        if (space) {
          selectSpace(space);
        }
      }
    });
    loadSpaces();
    return () => { sub.unsubscribe(); };
  }, []);

  // Listen for space selected event
  useEffect(() => {
    const sub = eventBus.on('wiki/space/selected', ({ space }) => {
      setSelectedSpace(space);
      setTree([]);
      setExpandedPaths(new Set());
      setTreeLoading(true);
      loadFileTree(space.slug, viewMode);

      // Apply ?file=... and ?line=... from the current URL so deep-links
      // from CommentsPage / ChangesPage open the correct file + selection.
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const filePath = params.get('file');
      const line = params.get('line');
      // CommentsPage may pass the original source_uri when the space's
      // git_project_key has drifted — use it so EnrichmentPanel loads the
      // correct comments from the backend.
      const sourceUriParam = params.get('source_uri');
      setOverrideSourceUri(sourceUriParam);
      if (filePath) {
        setSelectedFilePath(filePath);
        openFile(space, filePath);
        // Drive parent-folder auto-expansion (lazy-loaded subtree per level).
        setPendingExpandPath(filePath);
        if (line && Number.isFinite(Number(line))) {
          const n = Number(line);
          setSelectedLines({ start: n, end: n });
          // Open the Comments / enrichments panel so the targeted line is
          // immediately visible — that's the whole point of the deep-link.
          setShowEnrichments(true);
        } else {
          setSelectedLines(null);
          // Document-level deep-link from CommentsPage uses `?comments=1`
          // when there's no specific line to highlight.
          if (params.get('comments') === '1') {
            setShowEnrichments(true);
          }
        }
      } else {
        setSelectedFilePath(null);
        setSelectedLines(null);
        setPendingExpandPath(null);
      }
    });
    return () => { sub.unsubscribe(); };
  }, [viewMode]);

  // Load comments for the current file + keep count fresh on create/delete.
  useEffect(() => {
    if (!selectedSpace || !selectedFilePath) {
      setCommentsCount(0);
      setCommentLines(new Set());
      return undefined;
    }
    const sourceUri = overrideSourceUri || buildSourceUri(selectedSpace, selectedFilePath);
    const loadedSub = eventBus.on('wiki/comments/loaded', (payload) => {
      if (payload.sourceUri === sourceUri) {
        const list = payload.comments ?? [];
        setCommentsCount(list.length);
        const lines = new Set<number>();
        for (const c of list) {
          if (c.line_start) {
            const end = c.line_end ?? c.line_start;
            for (let n = c.line_start; n <= end; n++) {
              lines.add(n);
            }
          }
        }
        setCommentLines(lines);
      }
    });
    // Refresh count whenever a comment was created/deleted/resolved on this URI.
    const refresh = () => loadComments(sourceUri);
    const subs = [
      eventBus.on('wiki/comment/created', refresh),
      eventBus.on('wiki/comment/deleted', refresh),
      eventBus.on('wiki/comment/resolved', refresh),
    ];
    loadComments(sourceUri);
    return () => {
      loadedSub.unsubscribe();
      subs.forEach((s) => s.unsubscribe());
    };
  }, [selectedSpace, selectedFilePath, overrideSourceUri]);

  // Track which files in this space have pending drafts (used to mark them
  // in the tree, header, and to load draft content into the renderer).
  useEffect(() => {
    if (!selectedSpace) {
      setDraftsByPath(new Map());
      return undefined;
    }
    const sub = eventBus.on('wiki/drafts/loaded', ({ drafts: list, spaceId }) => {
      // Effect echoes back the requested space; ignore unrelated payloads.
      if (spaceId && spaceId !== selectedSpace.id) return;
      setDraftsByPath(new Map(list.map((d) => [d.file_path, d.id])));
    });
    const refresh = () => loadDrafts(selectedSpace.id);
    const refreshSubs = [
      eventBus.on('wiki/draft/saved', refresh),
      eventBus.on('wiki/draft/discarded', refresh),
      eventBus.on('wiki/draft/committed', refresh),
    ];
    refresh();
    return () => {
      sub.unsubscribe();
      refreshSubs.forEach((s) => s.unsubscribe());
    };
  }, [selectedSpace]);

  // Auto-expand ancestor folders for a deep-linked file. Each tree update
  // walks one level deeper: expand the next ancestor and lazy-load its
  // children if the backend hasn't returned them yet. Runs until every
  // ancestor along the path is expanded with children loaded.
  useEffect(() => {
    if (!pendingExpandPath || !selectedSpace || tree.length === 0) return;
    const segs = pendingExpandPath.split('/');
    if (segs.length <= 1) {
      // File at root — nothing to expand.
      setPendingExpandPath(null);
      return;
    }
    const ancestors: string[] = [];
    for (let i = 0; i < segs.length - 1; i++) {
      ancestors.push(segs.slice(0, i + 1).join('/'));
    }

    const findNode = (nodes: TreeNode[], path: string): TreeNode | null => {
      for (const n of nodes) {
        if (n.path === path) return n;
        if (n.children) {
          const found = findNode(n.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    const toExpand: string[] = [];
    let nextToLoad: string | null = null;
    for (const anc of ancestors) {
      const node = findNode(tree, anc);
      if (!node) {
        // Parent ancestor not loaded yet; stop and wait for next tree update.
        break;
      }
      toExpand.push(anc);
      if (!node.children || node.children.length === 0) {
        // This ancestor's children are missing — kick off lazy-load and
        // wait for the resulting tree update before walking further.
        nextToLoad = anc;
        break;
      }
    }

    if (toExpand.length > 0) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const p of toExpand) {
          if (!next.has(p)) {
            next.add(p);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
    if (nextToLoad) {
      loadGitSubtree(selectedSpace, nextToLoad);
    } else if (toExpand.length === ancestors.length) {
      // Every ancestor is loaded and expanded — we're done.
      setPendingExpandPath(null);
    }
  }, [pendingExpandPath, selectedSpace, tree]);

  // Splice lazy-loaded children into the existing tree at a given path.
  const spliceChildren = useCallback((path: string, children: TreeNode[]) => {
    const update = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((n) => {
        if (n.path === path) {
          return { ...n, children };
        }
        if (n.children && n.children.length > 0) {
          return { ...n, children: update(n.children) };
        }
        return n;
      });
    setTree((prev) => update(prev));
  }, []);

  // Listen for tree loaded / error events
  useEffect(() => {
    const subLoaded = eventBus.on('wiki/tree/loaded', ({ tree: newTree, path }) => {
      if (path) {
        // Lazy-load: subtree under `path`. Strip the parent prefix the
        // backend echoes so children paths stay relative to root.
        const prefix = path.endsWith('/') ? path : `${path}/`;
        const normalized = newTree.map((child) => ({
          ...child,
          path: child.path.startsWith(prefix) ? child.path : `${prefix}${child.path}`,
        }));
        spliceChildren(path, normalized);
      } else {
        setTree(newTree);
      }
      setTreeLoading(false);
      setTreeError(null);
    });
    const subError = eventBus.on('wiki/tree/error', ({ error }) => {
      setTreeError(error);
      setTreeLoading(false);
    });
    return () => {
      subLoaded.unsubscribe();
      subError.unsubscribe();
    };
  }, [spliceChildren]);

  // Listen for hash changes — re-select space, or just open a different file
  // when only `file=` / `line=` changed (deep-link from CommentsPage / ChangesPage).
  useEffect(() => {
    const handleHashChange = () => {
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const spaceSlug = urlParams.get('space');
      const filePath = urlParams.get('file');
      const lineParam = urlParams.get('line');
      if (!spaceSlug || allSpaces.length === 0) return;
      const space = allSpaces.find((s) => s.slug === spaceSlug);
      if (!space) return;

      if (space.slug !== selectedSpace?.slug) {
        // Different space — full reselect; the `wiki/space/selected` handler
        // applies file/line from URL.
        selectSpace(space);
        return;
      }

      // Same space — just navigate to a different file / line if requested.
      if (filePath && filePath !== selectedFilePath) {
        setSelectedFilePath(filePath);
        openFile(space, filePath);
        setPendingExpandPath(filePath);
      }
      if (lineParam && Number.isFinite(Number(lineParam))) {
        const n = Number(lineParam);
        setSelectedLines({ start: n, end: n });
        setShowEnrichments(true);
      } else if (urlParams.get('comments') === '1') {
        setShowEnrichments(true);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [allSpaces, selectedSpace, selectedFilePath]);

  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    setViewMode(newMode);
    if (selectedSpace) {
      setTreeLoading(true);
      loadFileTree(selectedSpace.slug, newMode);
    }
  }, [selectedSpace]);

  const handleToggleExpand = useCallback(
    (node: TreeNode) => {
      const path = node.path;
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          // Lazy-load subtree if this folder hasn't been expanded yet.
          // Goes via git-provider directly because the wiki tree endpoint
          // currently ignores `path` and would return root again.
          if (
            selectedSpace &&
            (!node.children || node.children.length === 0)
          ) {
            loadGitSubtree(selectedSpace, path);
          }
        }
        return next;
      });
    },
    [selectedSpace],
  );

  const handleSelectFile = useCallback(
    (node: TreeNode) => {
      if (node.type === 'dir') {
        handleToggleExpand(node);
      } else {
        setSelectedFilePath(node.path);
        setSelectedLines(null);
        setOverrideSourceUri(null);
        if (selectedSpace) {
          openFile(selectedSpace, node.path);
        }
      }
    },
    [handleToggleExpand, selectedSpace],
  );

  const allExpanded = tree.length > 0 && collectAllDirPaths(tree).every(p => expandedPaths.has(p));

  const handleToggleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedPaths(new Set());
    } else {
      setExpandedPaths(new Set(collectAllDirPaths(tree)));
    }
  }, [allExpanded, tree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedSpace) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-muted-foreground gap-4">
        <p className="text-lg">No space selected</p>
        <button
          onClick={() => navigate(Urls.Spaces)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          <ArrowLeft size={16} />
          Browse Spaces
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* File Tree Sidebar — toggled from the FileViewer header. */}
      {showTree && (
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
        {/* Space name + view-mode + expand/collapse */}
        <div className="px-3 py-1.5 flex items-center gap-2 border-b border-border">
          <div className="text-xs font-semibold uppercase text-muted-foreground truncate flex-1">
            {selectedSpace.name}
          </div>
          <div className="flex gap-0.5 p-0.5 rounded bg-muted flex-shrink-0">
            <button
              onClick={() => handleViewModeChange(ViewMode.Documents)}
              className={`p-1 rounded transition-colors ${viewMode === ViewMode.Documents ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
              title="Render — show display names from file mapping"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleViewModeChange(ViewMode.Dev)}
              className={`p-1 rounded transition-colors ${viewMode === ViewMode.Dev ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
              title="Raw — show real filenames"
            >
              <Code className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={handleToggleExpandAll}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground flex-shrink-0"
            title={allExpanded ? 'Collapse all' : 'Expand all'}
          >
            {allExpanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
          </button>
          <button
            onClick={() => setShowCreateFile(true)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground flex-shrink-0"
            title="Add file — create a new file in this repository"
          >
            <FilePlus size={14} />
          </button>
        </div>

        {/* Tree content */}
        <div className="flex-1 overflow-y-auto py-1">
          {treeLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {treeError && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive">
              <AlertCircle size={16} />
              <span>{treeError}</span>
            </div>
          )}
          {!treeLoading && !treeError && tree.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No files found</p>
          )}
          {!treeLoading &&
            tree.map((node) => (
              <TreeNodeItem
                key={node.path}
                node={node}
                level={0}
                expandedPaths={expandedPaths}
                selectedPath={selectedFilePath}
                viewMode={viewMode}
                draftPaths={draftPaths}
                onSelect={handleSelectFile}
              />
            ))}
        </div>
      </div>
      )}

      {/* Content Area — FileViewer manages its own overflow, so the wrapper
          only constrains width. The earlier `overflow-y-auto` here reserved
          a scrollbar gutter that showed up as a blank stripe on the right. */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {selectedFilePath ? (
          <FileViewer
            spaceSlug={selectedSpace.slug}
            spaceId={selectedSpace.id}
            spaceName={selectedSpace.name}
            filePath={selectedFilePath}
            onBack={() => setSelectedFilePath(null)}
            showComments={showEnrichments}
            onToggleComments={() => setShowEnrichments((v) => !v)}
            viewMode={fileViewMode}
            onViewModeChange={setFileViewMode}
            commentsCount={commentsCount}
            hasUnsavedDraft={selectedFilePath ? draftPaths.has(selectedFilePath) : false}
            draftId={selectedFilePath ? draftsByPath.get(selectedFilePath) : undefined}
            commentLines={commentLines}
            showTree={showTree}
            onToggleTree={() => setShowTree((v) => !v)}
            selectedLines={selectedLines}
            onLineClick={(line, opts) => {
              // Plain click anchors a single-line range; Shift+click extends
              // the current range to include this line.
              setSelectedLines((prev) => {
                if (opts?.shift && prev) {
                  return {
                    start: Math.min(prev.start, line),
                    end: Math.max(prev.end, line),
                  };
                }
                return { start: line, end: line };
              });
              setShowEnrichments(true);
            }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center px-8 py-12 text-muted-foreground">
            <FileText size={56} strokeWidth={1.5} className="mb-4 opacity-30" />
            <p className="text-base font-semibold text-foreground">Select a document</p>
            <p className="text-sm mt-1 max-w-xs">
              Pick any file from the tree on the left to view or edit its contents.
            </p>
          </div>
        )}

        {/* Enrichments panel is toggled via the FileViewer header now. */}
      </div>

      {/* Enrichments Panel */}
      {showEnrichments && selectedFilePath && selectedSpace && (
        <div className="w-96 flex-shrink-0 border-l border-border flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold uppercase text-muted-foreground">Enrichments</span>
            </div>
            <button
              onClick={() => setShowEnrichments(false)}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
              title="Close panel"
            >
              <PanelRightClose size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EnrichmentPanel
              sourceUri={overrideSourceUri || buildSourceUri(selectedSpace, selectedFilePath)}
              selectedLines={selectedLines}
              spaceId={selectedSpace.id}
              currentFilePath={selectedFilePath}
            />
          </div>
        </div>
      )}

      <CreateFileModal
        isOpen={showCreateFile}
        onClose={() => setShowCreateFile(false)}
        space={selectedSpace}
        onCreated={(newFilePath, draftId) => {
          // Register the freshly-created draft optimistically so the
          // FileViewer immediately knows there's a draft to fall back to —
          // without this it would race the loadDrafts round-trip and show
          // the "500 file does not exist in git" error.
          setDraftsByPath((prev) => {
            const next = new Map(prev);
            next.set(newFilePath, draftId);
            return next;
          });
          setSelectedFilePath(newFilePath);
          setSelectedLines(null);
          openFile(selectedSpace, newFilePath);
        }}
      />
    </div>
  );
};

// =============================================================================
// TreeNodeItem — recursive file tree node
// =============================================================================

interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  viewMode: ViewMode;
  draftPaths: Set<string>;
  onSelect: (node: TreeNode) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  level,
  expandedPaths,
  selectedPath,
  viewMode,
  draftPaths,
  onSelect,
}) => {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.path === selectedPath;
  const isDir = node.type === 'dir';
  const hasDraft = !isDir && draftPaths.has(node.path);
  const displayName = viewMode === ViewMode.Documents && node.display_name
    ? node.display_name
    : node.name;

  return (
    <>
      <button
        onClick={() => onSelect(node)}
        className={`w-full flex items-center gap-1.5 py-1 pr-2 text-sm transition-colors rounded-sm ${
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-muted'
        }`}
        style={{ paddingLeft: level * 16 + 8 }}
      >
        {isDir ? (
          isExpanded ? (
            <ChevronDown size={14} className="flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        {isDir ? (
          <FolderOpen size={14} className="flex-shrink-0 text-muted-foreground" />
        ) : viewMode === ViewMode.Documents ? (
          <FileText size={14} className="flex-shrink-0 text-muted-foreground" />
        ) : (
          <File size={14} className="flex-shrink-0 text-muted-foreground" />
        )}
        <span className="truncate flex-1 text-left">{displayName}</span>
        {hasDraft && (
          <span
            className="flex-shrink-0 inline-block w-2 h-2 rounded-full bg-yellow-500"
            title="Has unsaved changes"
            aria-label="Has unsaved changes"
          />
        )}
      </button>
      {isDir && isExpanded && node.children?.map((child) => (
        <TreeNodeItem
          key={child.path}
          node={child}
          level={level + 1}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          viewMode={viewMode}
          draftPaths={draftPaths}
          onSelect={onSelect}
        />
      ))}
    </>
  );
};


export default SpaceViewPage;
