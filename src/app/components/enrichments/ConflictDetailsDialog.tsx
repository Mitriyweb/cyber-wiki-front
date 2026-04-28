/**
 * ConflictDetailsDialog — modal for reviewing enrichment conflicts.
 * Ported from doclab ConflictDetailsDialog to host app.
 */

import React, { useState } from 'react';
import { EnrichmentType, type Enrichment, type DiffHunkRaw } from '@/app/api/wikiTypes';

interface ConflictDetailsDialogProps {
  conflicts: Enrichment[];
  initialIndex?: number;
  onClose: () => void;
}

function enrichmentLabel(e: Enrichment | null | undefined): string {
  if (!e) return '?';
  const d = e.data;
  if (e.type === EnrichmentType.PRDiff) return `PR #${d?.pr_number}`;
  if (e.type === EnrichmentType.Commit) return `Commit ${String(d?.commit_sha).slice(0, 7)}`;
  if (e.type === EnrichmentType.Edit) return 'Your pending edit';
  return String(e.type);
}

function HunkDiff({ hunk }: { hunk: DiffHunkRaw | undefined }) {
  if (!hunk?.lines?.length) return null;
  return (
    <pre className="text-xs rounded overflow-x-auto p-2 m-0 leading-5 bg-muted font-mono">
      {hunk.lines.map((line, i) => {
        const prefix = line[0];
        const content = line.slice(1);
        const colorClass =
          prefix === '+' ? 'text-green-700' : prefix === '-' ? 'text-red-700' : 'text-muted-foreground';
        return (
          <div key={i} className={colorClass}>
            {prefix}
            {content}
          </div>
        );
      })}
    </pre>
  );
}

export const ConflictDetailsDialog: React.FC<ConflictDetailsDialogProps> = ({
  conflicts,
  initialIndex = 0,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const conflict = conflicts[Math.min(index, conflicts.length - 1)];
  const { firstEnrichment, secondEnrichment, hunk } = (conflict?.data ?? {}) as {
    firstEnrichment?: Enrichment;
    secondEnrichment?: Enrichment;
    hunk?: DiffHunkRaw;
  };

  const winnerLabel = enrichmentLabel(firstEnrichment);
  const loserLabel = enrichmentLabel(secondEnrichment);
  const lineRange =
    conflict.lineStart === conflict.lineEnd
      ? `line ${conflict.lineStart}`
      : `lines ${conflict.lineStart}–${conflict.lineEnd}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-destructive/5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-destructive">⚠️ Conflict</span>
            {conflicts.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  disabled={index === 0}
                  onClick={() => setIndex(i => i - 1)}
                >
                  ‹
                </button>
                <span className="text-xs text-muted-foreground">
                  {index + 1} of {conflicts.length}
                </span>
                <button
                  className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  disabled={index === conflicts.length - 1}
                  onClick={() => setIndex(i => i + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
          <button
            className="text-muted-foreground hover:text-foreground text-base leading-none px-1"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {winnerLabel} and {loserLabel} both modify {lineRange}.
          </p>

          {/* Applied (winner) */}
          <div className="rounded-md border border-green-200 dark:border-green-800 overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border-b border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
              <span>✓ Applied</span>
              <span className="font-normal">{winnerLabel}</span>
            </div>
            <div className="px-3 py-2 text-xs text-muted-foreground">
              This change is visible in the document view.
            </div>
          </div>

          {/* Blocked (loser) */}
          <div className="rounded-md border border-red-200 dark:border-red-800 overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400">
              <span>✗ Blocked</span>
              <span className="font-normal">{loserLabel}</span>
            </div>
            <div className="p-2">
              {hunk ? (
                <HunkDiff hunk={hunk} />
              ) : (
                <p className="text-xs text-muted-foreground px-1">No hunk data available.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
