/**
 * ChangesTab — pending edit / committed changes panel.
 *
 * Per FR cpt-cyberwiki-fr-pending-changes / cpt-cyberwiki-fr-change-approval /
 * cpt-cyberwiki-fr-change-history. Shows draft edits and committed changes,
 * lets the user discard, commit, unstage, and open a PR.
 *
 * Talks to the system via actions (no direct API calls); listens to
 * wiki/draft/* and wiki/branch/* events to clear loading state.
 *
 * Ported from doclab components/main-view/sidebar/ChangesTab.tsx.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventBus } from '@cyberfabric/react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileText,
  GitCommit,
  GitPullRequest,
  Minus,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { commitDrafts, discardDraft } from '@/app/actions/draftChangeActions';
import {
  createPullRequest,
  unstageBranch,
} from '@/app/actions/userBranchActions';
import {
  EditChangeType,
  type CommitEnrichment,
  type DiffHunk,
  type EditEnrichment,
} from '@/app/api';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';

interface ChangesTabProps {
  currentFilePath?: string;
  spaceId?: string;
  editEnrichments?: EditEnrichment[];
  commitEnrichments?: CommitEnrichment[];
  onNavigateToFile?: (filePath: string) => void;
  onRefresh?: () => void;
}

interface ConfirmState {
  message: string;
  onConfirm: () => void;
  danger: boolean;
}

function changeTypeIcon(changeType: EditChangeType) {
  if (changeType === EditChangeType.Create) {
    return <Plus size={14} className="text-green-600" />;
  }
  if (changeType === EditChangeType.Delete) {
    return <Minus size={14} className="text-red-600" />;
  }
  return <Edit3 size={14} className="text-blue-600" />;
}

function changeTypeLabel(changeType: EditChangeType) {
  if (changeType === EditChangeType.Create) return 'New file';
  if (changeType === EditChangeType.Delete) return 'Deleted';
  return 'Modified';
}

function changeTypeBadgeClasses(changeType: EditChangeType) {
  if (changeType === EditChangeType.Create) {
    return 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300';
  }
  if (changeType === EditChangeType.Delete) {
    return 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300';
  }
  return 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300';
}

function HunkLine({ line }: { line: string }) {
  const isAddition = line.startsWith('+');
  const isDeletion = line.startsWith('-');
  const cls = isAddition
    ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
    : isDeletion
      ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
      : 'text-foreground';
  return <div className={`px-2 py-0.5 whitespace-pre-wrap break-all ${cls}`}>{line}</div>;
}

function HunkBlock({ hunk, headerClasses }: { hunk: DiffHunk; headerClasses: string }) {
  return (
    <div>
      <div className={`px-2 py-1 text-xs ${headerClasses}`}>
        @@ -{hunk.old_start},{hunk.old_count} +{hunk.new_start},{hunk.new_count} @@
      </div>
      <div className="text-xs">
        {hunk.lines.map((line, i) => (
          <HunkLine key={i} line={line} />
        ))}
      </div>
    </div>
  );
}

export function ChangesTab({
  currentFilePath,
  spaceId,
  editEnrichments = [],
  commitEnrichments = [],
  onNavigateToFile,
  onRefresh,
}: ChangesTabProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  // Clear loading + refresh on result events
  useEffect(() => {
    const finish = () => {
      setIsLoading(false);
      onRefresh?.();
    };
    const subs = [
      eventBus.on('wiki/draft/discarded', finish),
      eventBus.on('wiki/draft/committed', () => {
        setSelectedFiles(new Set());
        setCommitMessage('');
        finish();
      }),
      eventBus.on('wiki/draft/error', () => setIsLoading(false)),
      eventBus.on('wiki/branch/unstaged', finish),
      eventBus.on('wiki/pr/created', ({ result }) => {
        if (result?.pr_url) {
          window.open(result.pr_url, '_blank', 'noopener,noreferrer');
        }
        finish();
      }),
      eventBus.on('wiki/branch/error', () => setIsLoading(false)),
    ];
    return () => {
      subs.forEach((s) => s.unsubscribe());
    };
  }, [onRefresh]);

  const askConfirm = useCallback(
    (message: string, fn: () => void, danger = false) => {
      setConfirm({ message, onConfirm: fn, danger });
    },
    [],
  );

  const toggleExpanded = useCallback((key: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleFileSelection = useCallback((changeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(changeId)) next.delete(changeId);
      else next.add(changeId);
      return next;
    });
  }, []);

  const allSelected =
    selectedFiles.size === editEnrichments.length && editEnrichments.length > 0;

  const handleDiscard = useCallback(
    (changeId: string, filePath: string, e: React.MouseEvent) => {
      e.stopPropagation();
      askConfirm(
        `Discard changes to ${filePath}?`,
        () => {
          setIsLoading(true);
          discardDraft(changeId);
          setSelectedFiles((prev) => {
            const next = new Set(prev);
            next.delete(changeId);
            return next;
          });
        },
        true,
      );
    },
    [askConfirm],
  );

  const handleDiscardSelected = useCallback(() => {
    if (selectedFiles.size === 0) return;
    askConfirm(
      `Discard changes to ${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''}?`,
      () => {
        setIsLoading(true);
        for (const changeId of selectedFiles) {
          discardDraft(changeId);
        }
        setSelectedFiles(new Set());
      },
      true,
    );
  }, [askConfirm, selectedFiles]);

  const handleCommitSelected = useCallback(() => {
    if (selectedFiles.size === 0) return;
    setIsLoading(true);
    commitDrafts(Array.from(selectedFiles), commitMessage.trim() || undefined);
  }, [commitMessage, selectedFiles]);

  // Group committed changes by branch
  const commitGroups = useMemo(() => {
    const groups = new Map<string, CommitEnrichment[]>();
    for (const c of commitEnrichments) {
      const list = groups.get(c.id) ?? [];
      list.push(c);
      groups.set(c.id, list);
    }
    return groups;
  }, [commitEnrichments]);

  if (editEnrichments.length === 0 && commitEnrichments.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <FileText size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No pending changes</p>
        <p className="text-xs mt-1">Edit a file and save to see changes here</p>
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={confirm !== null}
        message={confirm?.message ?? ''}
        danger={confirm?.danger ?? false}
        confirmLabel={confirm?.danger ? 'Discard' : 'Confirm'}
        onConfirm={() => {
          const fn = confirm?.onConfirm;
          setConfirm(null);
          fn?.();
        }}
        onCancel={() => setConfirm(null)}
      />

      <div className="flex flex-col h-full">
        {/* Uncommitted changes header */}
        {editEnrichments.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-medium text-foreground">Uncommitted Changes</h3>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  {editEnrichments.length} file{editEnrichments.length !== 1 ? 's' : ''} changed
                  {selectedFiles.size > 0 && ` (${selectedFiles.size} selected)`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() =>
                  allSelected
                    ? setSelectedFiles(new Set())
                    : setSelectedFiles(new Set(editEnrichments.map((c) => c.id)))
                }
                className="flex items-center gap-1 px-2 py-1 text-xs rounded text-muted-foreground hover:bg-accent"
              >
                {allSelected ? <Check size={12} /> : <Square size={12} />}
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>

              <div className="flex-1" />

              <button
                type="button"
                onClick={handleCommitSelected}
                disabled={isLoading || selectedFiles.size === 0}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded disabled:opacity-50 ${
                  selectedFiles.size > 0
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-muted text-muted-foreground'
                }`}
                title="Commit selected changes to git"
              >
                <GitCommit size={12} />
                Commit
              </button>

              <button
                type="button"
                onClick={handleDiscardSelected}
                disabled={isLoading || selectedFiles.size === 0}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded disabled:opacity-50 ${
                  selectedFiles.size > 0
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-muted text-muted-foreground'
                }`}
                title="Discard selected changes"
              >
                <Trash2 size={12} />
                Discard
              </button>
            </div>

            {selectedFiles.size > 0 && (
              <div className="mt-2">
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message (optional)"
                  className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Edit (uncommitted) list */}
          {editEnrichments.map((change) => {
            const isExpanded = expandedFiles.has(change.file_path);
            const isCurrentFile = change.file_path === currentFilePath;
            const isSelected = selectedFiles.has(change.id);
            const rowClasses = isSelected
              ? 'bg-primary/10'
              : isCurrentFile
                ? 'bg-muted'
                : '';

            return (
              <div key={change.id} className="border-b border-border">
                <div
                  className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-accent/50 ${rowClasses}`}
                  onClick={() => toggleExpanded(change.file_path)}
                >
                  <button
                    type="button"
                    className="p-0.5 rounded hover:bg-accent"
                    onClick={(e) => toggleFileSelection(change.id, e)}
                    title={isSelected ? 'Deselect' : 'Select'}
                  >
                    {isSelected ? (
                      <Check size={14} className="text-green-600" />
                    ) : (
                      <Square size={14} className="text-muted-foreground" />
                    )}
                  </button>

                  <span className="p-0.5">
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-muted-foreground" />
                    ) : (
                      <ChevronRight size={14} className="text-muted-foreground" />
                    )}
                  </span>

                  {changeTypeIcon(change.change_type)}

                  <button
                    type="button"
                    className="flex-1 text-sm truncate text-left text-foreground hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToFile?.(change.file_path);
                    }}
                  >
                    {change.file_path}
                  </button>

                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${changeTypeBadgeClasses(change.change_type)}`}
                  >
                    {changeTypeLabel(change.change_type)}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleDiscard(change.id, change.file_path, e)}
                    className="p-1 rounded text-destructive hover:bg-destructive/10"
                    title="Discard this change"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="text-xs bg-muted">
                    <div className="px-4 py-2 border-b border-border">
                      {change.description && (
                        <p className="mb-2 text-muted-foreground">{change.description}</p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Last updated: {new Date(change.updated_at).toLocaleString()}
                      </div>
                    </div>

                    {change.diff_hunks && change.diff_hunks.length > 0 && (
                      <div className="font-mono">
                        {change.diff_hunks.map((hunk, i) => (
                          <HunkBlock
                            key={i}
                            hunk={hunk}
                            headerClasses="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Committed changes — grouped by branch */}
          {commitEnrichments.length > 0 && (
            <>
              <div className="px-4 py-3 border-b border-border bg-muted">
                <div className="flex items-center gap-2">
                  <GitCommit size={16} className="text-violet-600" />
                  <h3 className="text-sm font-medium text-foreground">Committed Changes</h3>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                    {commitEnrichments.length} file{commitEnrichments.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {Array.from(commitGroups.entries()).map(([branchId, files]) => {
                const rep = files[0];
                const workspaceName = rep.task_name || rep.branch_name;
                return (
                  <CommitGroup
                    key={branchId}
                    branchId={branchId}
                    workspaceName={workspaceName ?? rep.branch_name}
                    spaceId={spaceId}
                    rep={rep}
                    files={files}
                    currentFilePath={currentFilePath}
                    expandedFiles={expandedFiles}
                    isLoading={isLoading}
                    onToggleExpanded={toggleExpanded}
                    onNavigateToFile={onNavigateToFile}
                    onAskConfirm={askConfirm}
                    onSetLoading={setIsLoading}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}

interface CommitGroupProps {
  branchId: string;
  workspaceName: string;
  spaceId?: string;
  rep: CommitEnrichment;
  files: CommitEnrichment[];
  currentFilePath?: string;
  expandedFiles: Set<string>;
  isLoading: boolean;
  onToggleExpanded: (key: string) => void;
  onNavigateToFile?: (filePath: string) => void;
  onAskConfirm: (message: string, fn: () => void, danger?: boolean) => void;
  onSetLoading: (v: boolean) => void;
}

function CommitGroup({
  branchId,
  workspaceName,
  spaceId,
  rep,
  files,
  currentFilePath,
  expandedFiles,
  isLoading,
  onToggleExpanded,
  onNavigateToFile,
  onAskConfirm,
  onSetLoading,
}: CommitGroupProps) {
  const handleUnstage = () => {
    if (!spaceId) return;
    onAskConfirm(`Move commits from "${workspaceName}" back to draft edits?`, () => {
      onSetLoading(true);
      unstageBranch(spaceId, branchId);
    });
  };

  const handleCreatePr = () => {
    if (!spaceId) return;
    onSetLoading(true);
    createPullRequest({ spaceId, branchId });
  };

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted">
        <GitCommit size={13} className="text-violet-500 flex-shrink-0" />
        <span className="text-xs font-medium flex-1 truncate text-foreground">
          {workspaceName}
        </span>
        <span className="text-xs text-muted-foreground">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
        {spaceId && rep.pr_url && (
          <a
            href={rep.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
          >
            <ExternalLink size={11} />
            PR
          </a>
        )}
        {spaceId && !rep.pr_url && (
          <button
            type="button"
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-border bg-background text-muted-foreground disabled:opacity-50 hover:bg-accent"
            title="Move commits back to draft edits"
            onClick={handleUnstage}
          >
            <GitCommit size={11} />
            Unstage
          </button>
        )}
      </div>

      {files.map((commit) => {
        const fileKey = `commit-${branchId}-${commit.file_path}`;
        const isExpanded = expandedFiles.has(fileKey);
        const isCurrentFile = commit.file_path === currentFilePath;
        return (
          <div key={fileKey} className="border-b border-border">
            <div
              className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-accent/50 ${isCurrentFile ? 'bg-muted' : ''}`}
              onClick={() => onToggleExpanded(fileKey)}
            >
              <span className="p-0.5">
                {isExpanded ? (
                  <ChevronDown size={14} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={14} className="text-muted-foreground" />
                )}
              </span>
              <GitCommit size={14} className="text-violet-600" />
              <button
                type="button"
                className="flex-1 text-sm truncate text-left text-foreground hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToFile?.(commit.file_path);
                }}
              >
                {commit.file_path}
              </button>
              {(commit.additions || commit.deletions) && (
                <span className="text-xs text-muted-foreground">
                  <span className="text-green-600">+{commit.additions || 0}</span>
                  {' / '}
                  <span className="text-red-600">-{commit.deletions || 0}</span>
                </span>
              )}
              <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                Committed
              </span>
            </div>

            {isExpanded && (
              <div className="text-xs bg-muted">
                <div className="px-4 py-2 space-y-1 border-b border-border text-muted-foreground">
                  {commit.commit_sha && (
                    <div>
                      <span className="font-medium">Commit:</span>{' '}
                      <code className="bg-accent px-1 rounded">
                        {commit.commit_sha.slice(0, 8)}
                      </code>
                    </div>
                  )}
                  <div>Last updated: {new Date(commit.updated_at).toLocaleString()}</div>
                  {spaceId && !rep.pr_url && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 disabled:opacity-50"
                        disabled={isLoading}
                        onClick={handleCreatePr}
                      >
                        <GitPullRequest size={12} />
                        Create PR
                      </button>
                    </div>
                  )}
                </div>
                {commit.diff_hunks && commit.diff_hunks.length > 0 && (
                  <div className="font-mono">
                    {commit.diff_hunks.map((hunk, i) => (
                      <HunkBlock
                        key={i}
                        hunk={hunk}
                        headerClasses="bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
