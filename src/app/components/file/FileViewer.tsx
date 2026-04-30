/**
 * FileViewer
 *
 * Displays file content with rendered preview for Markdown
 * and raw line-numbered source view for all files.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { trim } from 'lodash';
import {
  FileText,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  Code,
  GitCompare,
  GitCommit,
  History,
  MessageSquare,
  Pencil,
  Save,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import FileRenderer from './FileRenderer';
import { MdRenderer } from './MdRenderer';
import BlameView from './BlameView';
import { DraftDiffView } from '@/app/components/changes/DraftDiffView';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';
import { ViewLoadingFallback } from '@/app/components/loading/ViewLoadingFallback';
import { Modal, ModalSize } from '@/app/components/primitives/Modal';
import { FileStatus } from './FileStatus';
import { HttpStatus } from '@/app/lib/httpStatus';
import { commitDrafts, getDraft, saveDraft } from '@/app/actions/draftChangeActions';
import { createPullRequest } from '@/app/actions/userBranchActions';
import { loadBlame } from '@/app/actions/wikiActions';
import {
  EditChangeType,
  FileType,
  FileViewMode,
  PRStatus,
  detectFileType,
  getLanguageLabel,
  type BlameLine,
  type Space,
} from '@/app/api/wikiTypes';

// Monaco-backed editor for non-markdown edit mode. Lazy-loaded so the ~3-4 MB
// `monaco-editor` bundle stays out of the initial chunk for users who only
// browse / open markdown files.
const CodeEditor = lazy(() => import('@/app/components/primitives/CodeEditor'));

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileViewerProps {
  spaceSlug: string;
  spaceId?: string;
  spaceName: string;
  /** Full space object — needed for the Blame request which goes straight
   *  to the git-provider API and needs git_provider/base_url/project_key/etc. */
  space?: Space;
  filePath: string;
  onBack: () => void;
  /** Optional Comments / enrichments-panel toggle. */
  showComments?: boolean;
  onToggleComments?: () => void;
  /** Controlled view-mode (lifted to the page so the user's choice survives
   *  navigation between files). Falls back to internal state if absent. */
  viewMode?: FileViewMode;
  onViewModeChange?: (mode: FileViewMode) => void;
  /** Line range currently selected for commenting (1-based). */
  selectedLines?: { start: number; end: number } | null;
  /** Click on a line / block selects it for commenting. `opts.shift` extends
   *  the existing range; plain click anchors a single-line range. */
  onLineClick?: (line: number, opts?: { shift?: boolean }) => void;
  /** Number of comments on this file (shown as a badge on the panel toggle). */
  commentsCount?: number;
  /** Whether this file has an unsaved draft on the server. */
  hasUnsavedDraft?: boolean;
  /** ID of the pending draft (if any). When set, FileViewer fetches the
   *  draft content and shows it (instead of the original) in read mode. */
  draftId?: string;
  /** True once SpaceViewPage has received its first wiki/drafts/loaded for
   *  this space. While false, suppress the "file not found" error so a
   *  freshly-created (draft-only) file deep-link doesn't flash an error
   *  before draftId/draftContent arrive. */
  draftsLoaded?: boolean;
  /** Lines (1-based) that have at least one comment anchored to them.
   *  Drives the gutter marker so the user can spot commented lines at a
   *  glance without scrolling through the comments panel. */
  commentLines?: Set<number>;
  /** Optional file-tree visibility toggle. When provided, FileViewer renders
   *  a button on the left side of its header so the user can reclaim the
   *  tree's horizontal space without leaving the page. */
  showTree?: boolean;
  onToggleTree?: () => void;
}

// ─── FileViewer ──────────────────────────────────────────────────────────────

const FileViewer: React.FC<FileViewerProps> = ({
  spaceSlug,
  spaceId,
  spaceName,
  space,
  filePath,
  onBack,
  showComments,
  onToggleComments,
  viewMode: viewModeProp,
  onViewModeChange,
  selectedLines,
  onLineClick,
  commentsCount,
  hasUnsavedDraft,
  draftId,
  draftsLoaded,
  commentLines,
  showTree,
  onToggleTree,
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Upstream status when the failure maps to a known git-provider HTTP
   *  code (HttpStatus enum). Drives `<FileStatus>` instead of the inline
   *  banner. Other errors keep the banner. */
  const [errorStatus, setErrorStatus] = useState<HttpStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const [internalViewMode, setInternalViewMode] = useState<FileViewMode>(FileViewMode.Preview);
  const viewMode = viewModeProp ?? internalViewMode;
  const setViewMode = useCallback(
    (mode: FileViewMode) => {
      if (onViewModeChange) onViewModeChange(mode);
      else setInternalViewMode(mode);
    },
    [onViewModeChange],
  );

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState(false);

  // Draft content fetched from server for files with `draftId`. When `showDraft`
  // is true (default while a draft exists), read-mode renders this instead of
  // the original file content from git. Toggle lets the user compare.
  //
  // `draftOriginal` is the snapshot of the file at the time the draft was
  // created — it's the correct baseline for "what did I change", because the
  // on-disk `content` can drift (upstream commits, line-ending normalization,
  // BOM stripping). Falling back to `content` keeps older drafts working when
  // the field is missing.
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [draftOriginal, setDraftOriginal] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(true);

  // Commit dialog (single-file commit from this header).
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  // Blame state — populated lazily when the user toggles the Blame view.
  const [blame, setBlame] = useState<BlameLine[]>([]);
  const [blameLoading, setBlameLoading] = useState(false);
  const [blameError, setBlameError] = useState<string | null>(null);
  const [blameSupported, setBlameSupported] = useState(true);

  const fileName = filePath.split('/').pop() || filePath;
  const breadcrumb = filePath.split('/').slice(0, -1).join(' / ');
  const languageLabel = useMemo(() => getLanguageLabel(fileName), [fileName]);
  const fileType = useMemo(() => detectFileType(fileName), [fileName]);
  const isMarkdown = fileType === FileType.Markdown;
  // The Source/Preview toggle is only meaningful for markdown (raw text vs
  // rendered HTML). Non-markdown files render through Monaco regardless of
  // viewMode, so showing two buttons that produce identical output would
  // just be noise — gate the toggle on `isMarkdown`.
  const hasUsefulPreview = isMarkdown;
  const isPreviewable = hasUsefulPreview;
  const isDirty = isEditMode && content !== null && draft !== content;
  // Hide the "Resource not found" banner while the drafts list is still being
  // resolved for this space, or while the known draft body is mid-flight —
  // both windows are transient races, not real errors.
  const errorSuppressed =
    !!error && (draftsLoaded === false || (!!draftId && draftContent === null));

  // Lines that differ between the on-disk file and the unsaved draft —
  // computed via the longest common subsequence so a single insertion near
  // the top doesn't paint everything below it yellow. Index-based comparison
  // (the previous approach) marked every line after a shift as changed.
  //
  // The LCS table is O(N*M); for unusually large files we bail out and skip
  // the highlight rather than freezing the UI.
  const changedLines = useMemo<Set<number> | undefined>(() => {
    if (!showDraft || draftContent === null) return undefined;
    // Diff against the snapshot the draft itself was based on, NOT against
    // the latest on-disk content. The latter can drift (upstream commits,
    // BOM stripping, line-ending normalization) and would flag every line
    // as changed even though the user only edited one.
    const baseline = draftOriginal ?? content;
    if (baseline === null) return undefined;
    if (draftContent === baseline) return undefined;
    // Normalize line endings before diffing so a CRLF vs LF mismatch
    // (common when the on-disk file was saved on Windows but the draft was
    // produced in the browser) doesn't flag every single line as changed.
    const orig = baseline.replace(/\r\n?/g, '\n').split('\n');
    const draftL = draftContent.replace(/\r\n?/g, '\n').split('\n');
    const n = orig.length;
    const m = draftL.length;
    // ~25M cells — keeps the diff responsive on typical wiki files but
    // refuses to lock up on enormous ones.
    if (n * m > 25_000_000) return undefined;

    // dp[i][j] = LCS length of orig[0..i) and draftL[0..j).
    const dp: Uint32Array[] = Array.from(
      { length: n + 1 },
      () => new Uint32Array(m + 1),
    );
    for (let i = 1; i <= n; i++) {
      const a = orig[i - 1];
      const row = dp[i];
      const prev = dp[i - 1];
      for (let j = 1; j <= m; j++) {
        if (a === draftL[j - 1]) {
          row[j] = prev[j - 1] + 1;
        } else {
          row[j] = prev[j] >= row[j - 1] ? prev[j] : row[j - 1];
        }
      }
    }

    // Backtrack — every draft line not part of the LCS is "changed".
    const inLcs = new Uint8Array(m);
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
      if (orig[i - 1] === draftL[j - 1]) {
        inLcs[j - 1] = 1;
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    const out = new Set<number>();
    for (let k = 0; k < m; k++) {
      if (!inLcs[k]) out.add(k + 1);
    }
    return out;
  }, [showDraft, draftContent, draftOriginal, content]);

  // Force Source whenever the file lands in Preview but doesn't have a useful
  // preview to render (non-markdown). Preview is the only mode without a
  // fallback for non-markdown; Diff/Blame work for any file and must NOT be
  // reverted here, otherwise their toolbar buttons silently no-op.
  useEffect(() => {
    if (!hasUsefulPreview && viewMode === FileViewMode.Preview) {
      setViewMode(FileViewMode.Source);
    }
  }, [hasUsefulPreview, viewMode, setViewMode]);

  // Listen for file content events. Subscriptions are mounted **once** so we
  // don't miss events fired during the unmount/remount window when the parent
  // calls `openFile()` synchronously after a deep-link change. Path comparison
  // goes through a ref so stale payloads for other files are still ignored.
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  useEffect(() => {
    const subLoading = eventBus.on('wiki/file/loading', (payload) => {
      if (payload.filePath === filePathRef.current) {
        setLoading(true);
        setError(null);
        setErrorStatus(null);
        setContent(null);
      }
    });
    const subLoaded = eventBus.on('wiki/file/loaded', (payload) => {
      if (payload.filePath === filePathRef.current) {
        setContent(payload.content);
        setDraft(payload.content);
        setLoading(false);
      }
    });
    const subError = eventBus.on('wiki/file/error', (payload) => {
      if (payload.filePath === filePathRef.current) {
        setError(payload.error);
        setErrorStatus(payload.status ?? null);
        setLoading(false);
      }
    });

    return () => {
      subLoading.unsubscribe();
      subLoaded.unsubscribe();
      subError.unsubscribe();
    };
  }, []);

  // Reset edit state when path changes
  useEffect(() => {
    setIsEditMode(false);
    setSavedToast(false);
    setShowDraft(true);
    setDraftContent(null);
    setDraftOriginal(null);
    // Each file owns its own blame; clear so the previous file's gutter
    // doesn't briefly show next to a different file's source while the new
    // request is in flight.
    setBlame([]);
    setBlameError(null);
    setBlameLoading(false);
    setBlameSupported(true);
  }, [filePath]);

  // Subscribe to blame results — kept independent of the on-demand fetch
  // so cached responses (effect-level cache) and re-fetches both flow
  // through the same path.
  useEffect(() => {
    const subLoaded = eventBus.on('wiki/blame/loaded', (payload) => {
      if (payload.filePath !== filePathRef.current) return;
      setBlame(payload.lines);
      setBlameSupported(payload.supported);
      setBlameLoading(false);
      setBlameError(null);
    });
    const subError = eventBus.on('wiki/blame/error', (payload) => {
      if (payload.filePath !== filePathRef.current) return;
      setBlameError(payload.error);
      setBlameLoading(false);
    });
    return () => {
      subLoaded.unsubscribe();
      subError.unsubscribe();
    };
  }, []);

  // Lazy-load blame when entering Blame view. We don't preload because the
  // blame call is heavier than the file fetch (full git history walk) and
  // most file opens never enter Blame.
  useEffect(() => {
    if (viewMode !== FileViewMode.Blame) return;
    if (!space) return;
    if (blame.length > 0 || blameLoading) return;
    setBlameLoading(true);
    setBlameError(null);
    loadBlame(space, filePath);
  }, [viewMode, space, filePath, blame.length, blameLoading]);

  // Fallback for newly-created files that don't exist on disk yet. The
  // backend's file-content endpoint 500s because there's nothing to read,
  // but we have a draft with the user's content. Once we have the draft
  // body, treat the original as empty and clear any error/loading state so
  // the viewer can render the draft + diff against an empty baseline.
  //
  // Watches `error` too, because wiki/file/error sometimes arrives *after*
  // the draft body has loaded (the file fetch is slower than the draft
  // fetch). Without this, the error banner would briefly succeed and then
  // get re-set by the late event.
  useEffect(() => {
    if (!draftId || draftContent === null) return;
    if (content === null) {
      setContent('');
      setLoading(false);
    }
    if (error) {
      setError(null);
      setErrorStatus(null);
    }
  }, [content, error, draftId, draftContent]);

  // Fetch draft content whenever the active draftId changes — show "my
  // version" in read mode so changes are visible without entering Edit.
  useEffect(() => {
    if (!draftId) {
      setDraftContent(null);
      setDraftOriginal(null);
      return undefined;
    }
    const sub = eventBus.on('wiki/draft/got', ({ draft: d }) => {
      if (d.id !== draftId) return;
      if (d.modified_content !== undefined) {
        setDraftContent(d.modified_content);
      }
      if (d.original_content !== undefined) {
        setDraftOriginal(d.original_content);
      }
    });
    getDraft(draftId);
    return () => {
      sub.unsubscribe();
    };
  }, [draftId]);

  // Esc — close the current file (when not editing).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditMode) onBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack, isEditMode]);

  // Listen for draft save result (briefly show "Saved" feedback)
  useEffect(() => {
    const savedSub = eventBus.on('wiki/draft/saved', () => {
      setSavedToast(true);
      setIsEditMode(false);
      setTimeout(() => setSavedToast(false), 2000);
    });
    const errorSub = eventBus.on('wiki/draft/error', () => {
      // Keep edit mode so user can retry; toast/error UI is global TODO
    });
    return () => {
      savedSub.unsubscribe();
      errorSub.unsubscribe();
    };
  }, []);

  // Inline post-commit status — when the user commits from this view (vs the
  // ChangesPage), they need to see whether the PR was auto-opened, attached
  // to an existing PR, or skipped. Banner clears itself after a short delay
  // (or on next interaction) so it doesn't permanently consume the toolbar.
  const [postCommitToast, setPostCommitToast] = useState<
    | {
        status: PRStatus;
        url: string | null;
        error: string | null;
        spaceId: string;
        retrying: boolean;
      }
    | null
  >(null);
  useEffect(() => {
    const subs = [
      eventBus.on('wiki/draft/committed', ({ pr, prError, prStatus, spaceId: committedSpaceId }) => {
        setPostCommitToast({
          status: prStatus ?? (pr ? PRStatus.Existing : PRStatus.NotAttempted),
          url: pr?.prUrl ?? null,
          error: prError ?? null,
          spaceId: committedSpaceId,
          retrying: false,
        });
      }),
      eventBus.on('wiki/pr/created', ({ result }) => {
        setPostCommitToast((prev) =>
          prev && prev.retrying
            ? { ...prev, status: PRStatus.Created, url: result.pr_url, error: null, retrying: false }
            : prev,
        );
      }),
      eventBus.on('wiki/branch/error', ({ error: msg }) => {
        setPostCommitToast((prev) =>
          prev && prev.retrying
            ? { ...prev, status: PRStatus.Failed, error: msg, retrying: false }
            : prev,
        );
      }),
    ];
    return () => subs.forEach((s) => s.unsubscribe());
  }, []);
  // Auto-dismiss success states after 8s; failures stick until the user
  // clicks them away so the reason isn't lost in a flash.
  useEffect(() => {
    if (!postCommitToast) return undefined;
    if (postCommitToast.status === PRStatus.Failed) return undefined;
    const t = setTimeout(() => setPostCommitToast(null), 8000);
    return () => clearTimeout(t);
  }, [postCommitToast]);

  const handleStartEdit = useCallback(() => {
    if (content === null) return;
    // Continue from the existing draft if there is one — otherwise start
    // from the file's current content in git.
    setDraft(draftContent ?? content);
    setIsEditMode(true);
    // For non-markdown files start in Source so the user can type immediately;
    // for markdown the default Preview maps to Milkdown WYSIWYG.
    if (!isMarkdown) {
      setViewMode(FileViewMode.Source);
    }
  }, [content, draftContent, isMarkdown, setViewMode]);

  const handleCancelEdit = useCallback(() => {
    if (isDirty) {
      setPendingDiscard(true);
      return;
    }
    setIsEditMode(false);
  }, [isDirty]);

  const performDiscard = useCallback(() => {
    setDraft(content ?? '');
    setIsEditMode(false);
    setPendingDiscard(false);
  }, [content]);

  const handleSave = useCallback(() => {
    if (!spaceId || content === null || !isDirty) return;
    saveDraft({
      spaceId,
      filePath,
      originalContent: content,
      modifiedContent: draft,
      changeType: EditChangeType.Modify,
      description: '',
    });
  }, [content, draft, filePath, isDirty, spaceId]);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [content]);

  /**
   * Content the user is actually looking at right now — the stat bar must
   * mirror this, not the original. Picks `draft` in non-markdown edit
   * mode, the staged draft in read-mode "My changes", and falls back to
   * the upstream `content`. Markdown edit mode owns its own stat bar in
   * `MdRenderer`, so no branch is needed for it here.
   */
  const displayedContent = useMemo(() => {
    if (isEditMode && !isMarkdown) return draft;
    if (draftContent !== null && showDraft) return draftContent;
    return content ?? '';
  }, [content, draft, draftContent, isEditMode, isMarkdown, showDraft]);

  const lines = useMemo(() => displayedContent.split('\n'), [displayedContent]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ConfirmDialog
        open={pendingDiscard}
        title={t('fileViewer.discardConfirmTitle')}
        message={t('fileViewer.discardConfirmMessage')}
        confirmLabel={t('common.discard')}
        danger
        onConfirm={performDiscard}
        onCancel={() => setPendingDiscard(false)}
      />

      {/* Commit dialog — single-file commit. The Changes page is still the
          place for multi-file commits and PR creation; this is a quick path
          for the file the user is currently looking at. */}
      {draftId && (
        <Modal
          open={commitOpen}
          onClose={() => setCommitOpen(false)}
          size={ModalSize.Md}
          title={t('fileViewer.commitDialogTitle')}
        >
          <Modal.Body className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('fileViewer.commitDialogIntro', { fileName })}
            </p>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('fileViewer.commitMessageLabel')} <span className="text-destructive">*</span>
              </label>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                placeholder={t('fileViewer.commitMessagePlaceholder')}
                rows={3}
                required
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('fileViewer.commitDialogFooterPrefix')}{' '}
              <a href="#changes" className="underline hover:text-foreground">
                {t('fileViewer.commitDialogFooterLink')}
              </a>
              .
            </p>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => setCommitOpen(false)}
              className="px-3 py-1.5 rounded-md text-sm text-foreground hover:bg-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                const message = trim(commitMessage);
                if (!message) return;
                commitDrafts([draftId], message);
                setCommitOpen(false);
              }}
              disabled={!trim(commitMessage)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !trim(commitMessage) ? t('fileViewer.commitTitleEmpty') : t('fileViewer.commitTitleReady')
              }
            >
              <GitCommit size={14} />
              {t('fileViewer.commitButton')}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Header */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-3 bg-muted">
        {/* Tree toggle — reclaim horizontal space when reading. */}
        {onToggleTree && (
          <button
            type="button"
            onClick={onToggleTree}
            className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground flex-shrink-0"
            title={showTree ? t('fileViewer.hideTreeTitle') : t('fileViewer.showTreeTitle')}
          >
            {showTree ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-muted-foreground flex-shrink-0" />
            <h2 className="text-sm font-semibold text-foreground truncate">{fileName}</h2>
            <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-muted-foreground flex-shrink-0">
              {languageLabel}
            </span>
            {isEditMode && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                {t('fileViewer.editingBadge')}
              </span>
            )}
            {savedToast && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300 flex-shrink-0">
                {t('fileViewer.savedBadge')}
              </span>
            )}
            {hasUnsavedDraft && !isEditMode && !savedToast && (
              <button
                type="button"
                onClick={() => setShowDraft((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300 flex-shrink-0 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                title={showDraft ? t('fileViewer.myChangesTooltip') : t('fileViewer.originalTooltip')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                {showDraft ? t('fileViewer.myChanges') : t('fileViewer.originalLabel')}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {spaceName}{breadcrumb ? ` / ${breadcrumb}` : ''}
          </p>
        </div>

        {/* Edit / Save / Cancel */}
        {isEditMode ? (
          <>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              title={t('fileViewer.saveTitle')}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-border disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                isDirty
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-background text-muted-foreground'
              }`}
            >
              <Save size={12} />
              {t('fileViewer.save')}
            </button>
            <button
              onClick={handleCancelEdit}
              title={t('fileViewer.discardEditsTitle')}
              className="flex items-center px-1.5 py-1 text-xs rounded border border-border bg-background text-muted-foreground hover:bg-accent flex-shrink-0"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          spaceId && (
            <>
              <button
                onClick={handleStartEdit}
                disabled={content === null}
                title={t('fileViewer.editFileTitle')}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-border bg-background text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Pencil size={12} />
                {t('fileViewer.edit')}
              </button>
              {hasUnsavedDraft && draftId && (
                <button
                  onClick={() => {
                    // Pre-fill a sensible commit message so the dialog isn't
                    // a forced typing exercise — the user can hit Commit
                    // immediately or refine the wording. Backend rejects
                    // empty messages, so we don't ship the empty state.
                    setCommitMessage(t('fileViewer.commitMessagePrefill', { fileName }));
                    setCommitOpen(true);
                  }}
                  title={t('fileViewer.commitDraftTitle')}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 flex-shrink-0"
                >
                  <GitCommit size={12} />
                  {t('fileViewer.commitButton')}
                </button>
              )}
            </>
          )
        )}

        {/* View mode toggle (Preview / Source / Diff / Blame) — Preview is
            hidden for plain-text files; Diff appears only when there's an
            unsaved draft that actually differs from the on-disk version;
            Blame is shown whenever we have a Space (any committed file).
            In markdown edit, Source = raw textarea, Preview = WYSIWYG. */}
        {(hasUsefulPreview || (hasUnsavedDraft && draftContent !== null) || !!space) && !isEditMode && (
          <div className="flex items-center border border-border rounded overflow-hidden flex-shrink-0">
            {isPreviewable && (
              <>
                <button
                  onClick={() => setViewMode(FileViewMode.Preview)}
                  className={`p-1.5 transition-colors ${viewMode === FileViewMode.Preview ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                  title={t('fileViewer.previewTitle')}
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => setViewMode(FileViewMode.Source)}
                  className={`p-1.5 transition-colors ${viewMode === FileViewMode.Source ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                  title={t('fileViewer.sourceTitle')}
                >
                  <Code size={14} />
                </button>
              </>
            )}
            {hasUnsavedDraft && draftContent !== null && content !== null && (
              <button
                onClick={() => setViewMode(FileViewMode.Diff)}
                className={`p-1.5 transition-colors ${viewMode === FileViewMode.Diff ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                title={t('fileViewer.diffTitle')}
              >
                <GitCompare size={14} />
              </button>
            )}
            {space && (
              <button
                onClick={() => setViewMode(FileViewMode.Blame)}
                className={`p-1.5 transition-colors ${viewMode === FileViewMode.Blame ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                title={t('fileViewer.blameTitle')}
              >
                <History size={14} />
              </button>
            )}
          </div>
        )}
        {/* Same toggle but minimal — Source only — for read mode on a
            plain-text file with no draft (so the user still has the toggle
            disabled-looking but consistent layout). */}
        {!hasUsefulPreview && !(hasUnsavedDraft && draftContent !== null) && !isEditMode && null}

        {/* Copy — hidden in edit mode (would copy stale content vs draft). */}
        {!isEditMode && (
          <button
            onClick={handleCopy}
            disabled={!content}
            className="p-1.5 rounded hover:bg-background transition-colors text-muted-foreground disabled:opacity-30 flex-shrink-0"
            title={t('fileViewer.copyTitle')}
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        )}

        {/* Enrichments panel toggle (comments / diffs / PRs / changes). */}
        {onToggleComments && (
          <button
            type="button"
            onClick={onToggleComments}
            title={showComments ? t('fileViewer.hideCommentsTitle') : t('fileViewer.showCommentsTitle')}
            className={`relative p-1.5 rounded flex-shrink-0 transition-colors ${
              showComments
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <MessageSquare size={14} />
            {commentsCount !== undefined && commentsCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 rounded-full text-[0.625rem] font-medium leading-4 text-center ${
                  showComments
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {commentsCount > 99 ? '99+' : commentsCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Post-commit banner — sits between the header and the content so the
          user immediately sees whether the PR was opened/attached/failed. */}
      {postCommitToast && (
        <PostCommitBanner
          status={postCommitToast.status}
          url={postCommitToast.url}
          error={postCommitToast.error}
          retrying={postCommitToast.retrying}
          onRetry={() => {
            setPostCommitToast((prev) => (prev ? { ...prev, retrying: true } : prev));
            createPullRequest({ spaceId: postCommitToast.spaceId });
          }}
          onDismiss={() => setPostCommitToast(null)}
        />
      )}

      {/* Content */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Suppress the file-fetch error while drafts are still being discovered
          (deep-link to a created-as-draft file 500s on git but recovers once
          the drafts list arrives) or while the known draft body is still in
          flight. The fallback effect will clear the error once draftContent
          loads; until then, render a spinner instead of a misleading error. */}
      {error && !errorSuppressed && errorStatus !== null && (
        <FileStatus code={errorStatus} />
      )}
      {error && !errorSuppressed && errorStatus === null && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}
      {error && errorSuppressed && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !error && content !== null && !isEditMode
        && viewMode !== FileViewMode.Diff
        && viewMode !== FileViewMode.Blame && (
        <div className="flex-1 overflow-auto">
          <FileRenderer
            content={
              draftContent !== null && showDraft ? draftContent : content
            }
            filePath={filePath}
            mode={viewMode}
            selectedLines={selectedLines}
            onLineClick={onLineClick}
            commentLines={commentLines}
            changedLines={changedLines}
          />
        </div>
      )}

      {!loading && !error && content !== null && !isEditMode && viewMode === FileViewMode.Diff && (
        <div className="flex-1 overflow-auto">
          <DraftDiffView
            original={draftOriginal ?? content}
            modified={draftContent ?? content}
          />
        </div>
      )}

      {!loading && !error && content !== null && !isEditMode && viewMode === FileViewMode.Blame && (
        <div className="flex-1 overflow-auto">
          <BlameView
            content={content}
            blame={blame}
            loading={blameLoading}
            error={blameError}
            unsupported={!blameSupported}
          />
        </div>
      )}

      {/* Edit mode for Markdown: full-width WYSIWYG editor (Milkdown).
          Save / source-toggle live in the FileViewer header (Eye = WYSIWYG,
          Code = source) — MdRenderer just owns the editor + stat-bar. */}
      {!loading && !error && isEditMode && isMarkdown && content !== null && (
        <div className="flex-1 flex overflow-hidden min-h-0">
          <MdRenderer
            initialContent={content}
            content={draft}
            isSourceMode={viewMode === FileViewMode.Source}
            onChange={setDraft}
          />
        </div>
      )}

      {/* Edit mode for non-Markdown:
          - Source view → Monaco editor (syntax highlighting, line numbers, folding)
          - Preview view → read-only FileRenderer of the current draft
          The header's Eye / Code toggle drives this. */}
      {!loading && !error && isEditMode && !isMarkdown && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background">
          {viewMode === FileViewMode.Source ? (
            <Suspense fallback={<ViewLoadingFallback />}>
              <CodeEditor
                value={draft}
                language={getLanguageLabel(fileName)}
                onChange={setDraft}
              />
            </Suspense>
          ) : (
            <div className="flex-1 overflow-auto">
              <FileRenderer content={draft} filePath={filePath} mode={viewMode} />
            </div>
          )}
        </div>
      )}

      {/* Footer status bar — hidden during Markdown edit (MdRenderer has its own). */}
      {!loading && content !== null && !(isEditMode && isMarkdown) && (
        <div className="border-t border-border px-4 py-1 flex items-center gap-4 text-xs text-muted-foreground bg-muted">
          <span>{t('fileViewer.linesCount', { count: lines.length })}</span>
          <span>{t('fileViewer.charactersCount', { count: displayedContent.length })}</span>
          <span className="ml-auto">{spaceSlug} / {filePath}</span>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// PostCommitBanner — shows what happened to the PR alongside the commit.
// =============================================================================

interface PostCommitBannerProps {
  status: PRStatus;
  url: string | null;
  error: string | null;
  retrying: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

function PostCommitBanner({ status, url, error, retrying, onRetry, onDismiss }: PostCommitBannerProps) {
  const { t } = useTranslation();
  const isOk = status === PRStatus.Created || status === PRStatus.Existing;
  const isFail = status === PRStatus.Failed;
  const headline =
    status === PRStatus.Created
      ? t('postCommitBanner.headlineCreated')
      : status === PRStatus.Existing
        ? t('postCommitBanner.headlineExisting')
        : status === PRStatus.Failed
          ? t('postCommitBanner.headlineFailed')
          : t('postCommitBanner.headlineNotAttempted');
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 text-xs border-b ${
        isOk
          ? 'border-blue-500/30 bg-blue-500/10 text-foreground'
          : isFail
            ? 'border-yellow-500/30 bg-yellow-500/10 text-foreground'
            : 'border-border bg-muted text-muted-foreground'
      }`}
    >
      {isOk ? (
        <GitCommit size={12} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
      ) : (
        <AlertCircle size={12} className={`flex-shrink-0 ${isFail ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`} />
      )}
      <span className="font-medium">{headline}</span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline text-blue-600 dark:text-blue-400 truncate"
        >
          {url}
        </a>
      )}
      {error && !url && (
        <span className="text-yellow-700 dark:text-yellow-300 truncate" title={error}>
          {error}
        </span>
      )}
      {isFail && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-500/20 disabled:opacity-50 flex-shrink-0"
        >
          <GitCommit size={11} />
          {retrying ? t('postCommitBanner.retrying') : t('postCommitBanner.retry')}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className={`${isFail ? '' : 'ml-auto'} p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0`}
        title={t('fileViewer.dismissTitle')}
        aria-label={t('fileViewer.dismissTitle')}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default FileViewer;
