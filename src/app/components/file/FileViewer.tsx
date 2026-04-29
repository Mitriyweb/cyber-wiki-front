/**
 * FileViewer
 *
 * Displays file content with rendered preview for Markdown
 * and raw line-numbered source view for all files.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { eventBus } from '@cyberfabric/react';
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
  MessageSquare,
  Pencil,
  Save,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import FileRenderer from './FileRenderer';
import { MdRenderer } from './MdRenderer';
import { DraftDiffView } from '@/app/components/changes/DraftDiffView';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';
import { commitDrafts, getDraft, saveDraft } from '@/app/actions/draftChangeActions';
import {
  EditChangeType,
  FileType,
  FileViewMode,
  detectFileType,
  getLanguageLabel,
} from '@/app/api/wikiTypes';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileViewerProps {
  spaceSlug: string;
  spaceId?: string;
  spaceName: string;
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
  commentLines,
  showTree,
  onToggleTree,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(true);

  // Commit dialog (single-file commit from this header).
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  const fileName = filePath.split('/').pop() || filePath;
  const breadcrumb = filePath.split('/').slice(0, -1).join(' / ');
  const languageLabel = useMemo(() => getLanguageLabel(fileName), [fileName]);
  const fileType = useMemo(() => detectFileType(fileName), [fileName]);
  const isMarkdown = fileType === FileType.Markdown;
  // Preview / WYSIWYG only makes sense for markdown. Code / yaml / plain
  // text show their raw form regardless, so we hide the Eye/Code toggle
  // and lock the viewMode to Source for everything except markdown.
  const hasUsefulPreview = isMarkdown;
  const isPreviewable = hasUsefulPreview;
  const isDirty = isEditMode && content !== null && draft !== content;

  // Lines that differ between the on-disk file and the unsaved draft —
  // computed via the longest common subsequence so a single insertion near
  // the top doesn't paint everything below it yellow. Index-based comparison
  // (the previous approach) marked every line after a shift as changed.
  //
  // The LCS table is O(N*M); for unusually large files we bail out and skip
  // the highlight rather than freezing the UI.
  const changedLines = useMemo<Set<number> | undefined>(() => {
    if (!showDraft || draftContent === null || content === null) return undefined;
    if (draftContent === content) return undefined;
    // Normalize line endings before diffing so a CRLF vs LF mismatch
    // (common when the on-disk file was saved on Windows but the draft was
    // produced in the browser) doesn't flag every single line as changed.
    const orig = content.replace(/\r\n?/g, '\n').split('\n');
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
  }, [showDraft, draftContent, content]);

  // Force Source mode when no useful preview is available.
  useEffect(() => {
    if (!hasUsefulPreview && viewMode !== FileViewMode.Source) {
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
  }, [filePath]);

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
    if (error) setError(null);
  }, [content, error, draftId, draftContent]);

  // Fetch draft content whenever the active draftId changes — show "my
  // version" in read mode so changes are visible without entering Edit.
  useEffect(() => {
    if (!draftId) {
      setDraftContent(null);
      return undefined;
    }
    const sub = eventBus.on('wiki/draft/got', ({ draft: d }) => {
      if (d.id === draftId && d.modified_content !== undefined) {
        setDraftContent(d.modified_content);
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

  const lines = useMemo(() => content?.split('\n') ?? [], [content]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ConfirmDialog
        open={pendingDiscard}
        title="Discard changes?"
        message="You have unsaved edits. Discard them?"
        confirmLabel="Discard"
        danger
        onConfirm={performDiscard}
        onCancel={() => setPendingDiscard(false)}
      />

      {/* Commit dialog — single-file commit. The Changes page is still the
          place for multi-file commits and PR creation; this is a quick path
          for the file the user is currently looking at. */}
      {commitOpen && draftId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 rounded-lg shadow-xl bg-card border border-border">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Commit changes</h3>
              <button
                type="button"
                onClick={() => setCommitOpen(false)}
                className="p-1 rounded text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Commit your draft for <span className="font-medium text-foreground">{fileName}</span>{' '}
                to the repository. This creates a real commit on a user branch — your team
                will be able to see and review it.
              </p>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Commit message <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="Describe what you changed"
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                For multi-file commits or to open a pull request, use the{' '}
                <a href="#changes" className="underline hover:text-foreground">
                  Changes page
                </a>
                .
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
              <button
                type="button"
                onClick={() => setCommitOpen(false)}
                className="px-3 py-1.5 rounded-md text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const message = commitMessage.trim();
                  if (!message) return;
                  commitDrafts([draftId], message);
                  setCommitOpen(false);
                }}
                disabled={!commitMessage.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !commitMessage.trim()
                    ? 'Enter a commit message first'
                    : 'Commit'
                }
              >
                <GitCommit size={14} />
                Commit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-3 bg-muted">
        {/* Tree toggle — reclaim horizontal space when reading. */}
        {onToggleTree && (
          <button
            type="button"
            onClick={onToggleTree}
            className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground flex-shrink-0"
            title={showTree ? 'Hide file tree' : 'Show file tree'}
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
                Editing
              </span>
            )}
            {savedToast && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300 flex-shrink-0">
                Saved
              </span>
            )}
            {hasUnsavedDraft && !isEditMode && !savedToast && (
              <button
                type="button"
                onClick={() => setShowDraft((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300 flex-shrink-0 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                title={
                  showDraft
                    ? 'Showing your changes — click to view original'
                    : 'Showing original — click to view your changes'
                }
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                {showDraft ? 'My changes' : 'Original'}
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
              title="Save draft"
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-border disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                isDirty
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-background text-muted-foreground'
              }`}
            >
              <Save size={12} />
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              title="Discard changes"
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
                title="Edit file"
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-border bg-background text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Pencil size={12} />
                Edit
              </button>
              {hasUnsavedDraft && draftId && (
                <button
                  onClick={() => {
                    // Pre-fill a sensible commit message so the dialog isn't
                    // a forced typing exercise — the user can hit Commit
                    // immediately or refine the wording. Backend rejects
                    // empty messages, so we don't ship the empty state.
                    setCommitMessage(`Update ${fileName}`);
                    setCommitOpen(true);
                  }}
                  title="Commit this draft to the repository"
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 flex-shrink-0"
                >
                  <GitCommit size={12} />
                  Commit
                </button>
              )}
            </>
          )
        )}

        {/* View mode toggle (Preview / Source / Diff) — Preview is hidden for
            plain-text files; Diff appears only when there's an unsaved draft
            that actually differs from the on-disk version. In markdown edit,
            Source = raw textarea and Preview = WYSIWYG (Milkdown). */}
        {(hasUsefulPreview || (hasUnsavedDraft && draftContent !== null)) && !isEditMode && (
          <div className="flex items-center border border-border rounded overflow-hidden flex-shrink-0">
            {isPreviewable && (
              <button
                onClick={() => setViewMode(FileViewMode.Preview)}
                className={`p-1.5 transition-colors ${viewMode === FileViewMode.Preview ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                title="Preview"
              >
                <Eye size={14} />
              </button>
            )}
            <button
              onClick={() => setViewMode(FileViewMode.Source)}
              className={`p-1.5 transition-colors ${viewMode === FileViewMode.Source ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
              title="Source"
            >
              <Code size={14} />
            </button>
            {hasUnsavedDraft && draftContent !== null && content !== null && (
              <button
                onClick={() => setViewMode(FileViewMode.Diff)}
                className={`p-1.5 transition-colors ${viewMode === FileViewMode.Diff ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                title="Diff — see exactly what changed"
              >
                <GitCompare size={14} />
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
            title="Copy content"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        )}

        {/* Enrichments panel toggle (comments / diffs / PRs / changes). */}
        {onToggleComments && (
          <button
            type="button"
            onClick={onToggleComments}
            title={showComments ? 'Hide enrichments panel' : 'Show enrichments panel'}
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

      {/* Content */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {!loading && !error && content !== null && !isEditMode && viewMode !== FileViewMode.Diff && (
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
            original={content}
            modified={draftContent ?? content}
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
          - Source view → editable textarea (default)
          - Preview view → read-only FileRenderer of the current draft
          The header's Eye / Code toggle drives this. */}
      {!loading && !error && isEditMode && !isMarkdown && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background">
          {viewMode === FileViewMode.Source ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full font-mono text-sm leading-relaxed p-4 bg-background text-foreground focus:outline-none resize-none"
            />
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
          <span>{lines.length} lines</span>
          <span>{content.length} characters</span>
          <span className="ml-auto">{spaceSlug} / {filePath}</span>
        </div>
      )}
    </div>
  );
};

export default FileViewer;
