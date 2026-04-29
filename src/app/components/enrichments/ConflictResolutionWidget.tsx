/**
 * ConflictResolutionWidget — modal for resolving conflicts between
 * uncommitted edits and committed changes (FR cpt-cyberwiki-fr-conflict-detection).
 *
 * User picks which version to keep; the other is discarded.
 *
 * Ported from doclab components/main-view/content/ConflictResolutionWidget.tsx.
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Edit3, GitCommit, X } from 'lucide-react';
import type { DiffHunk } from '@/app/api';

interface ConflictResolutionWidgetProps {
  open: boolean;
  filePath: string;
  uncommittedHunks: DiffHunk[];
  committedHunks: DiffHunk[];
  onKeepUncommitted: () => void;
  onKeepCommitted: () => void;
  onDismiss: () => void;
}

function getAddedLines(hunks: DiffHunk[]): string[] {
  const out: string[] = [];
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        out.push(line.slice(1));
      }
    }
  }
  return out;
}

export function ConflictResolutionWidget({
  open,
  filePath,
  uncommittedHunks,
  committedHunks,
  onKeepUncommitted,
  onKeepCommitted,
  onDismiss,
}: ConflictResolutionWidgetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const uncommittedAdded = getAddedLines(uncommittedHunks);
  const committedAdded = getAddedLines(committedHunks);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-4xl mx-4 rounded-lg shadow-xl overflow-hidden bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900">
          <AlertTriangle size={20} className="text-red-600" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800 dark:text-red-200">Conflict Detected</h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              Your uncommitted changes conflict with committed changes in{' '}
              <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">{filePath}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50"
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        {/* Side-by-side comparison */}
        <div className="flex divide-x divide-border">
          <div className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Edit3 size={16} className="text-blue-600" />
              <h4 className="font-medium text-foreground">Your Uncommitted Changes</h4>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                Draft
              </span>
            </div>
            <div className="rounded border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 overflow-auto max-h-64 font-mono text-xs">
              {uncommittedAdded.length > 0 ? (
                uncommittedAdded.map((line, i) => (
                  <div
                    key={i}
                    className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
                  >
                    + {line}
                  </div>
                ))
              ) : (
                <div className="px-2 py-2 text-muted-foreground italic">No additions</div>
              )}
            </div>
          </div>

          <div className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitCommit size={16} className="text-violet-600" />
              <h4 className="font-medium text-foreground">Committed Changes</h4>
              <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                In Git
              </span>
            </div>
            <div className="rounded border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 overflow-auto max-h-64 font-mono text-xs">
              {committedAdded.length > 0 ? (
                committedAdded.map((line, i) => (
                  <div
                    key={i}
                    className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100"
                  >
                    + {line}
                  </div>
                ))
              ) : (
                <div className="px-2 py-2 text-muted-foreground italic">No additions</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted">
          <p className="text-sm text-muted-foreground">
            Choose which version to keep. The other will be discarded.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onKeepCommitted}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded border border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50"
            >
              <Check size={14} />
              Keep Committed
            </button>
            <button
              type="button"
              onClick={onKeepUncommitted}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded border border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
            >
              <Check size={14} />
              Keep Uncommitted
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
