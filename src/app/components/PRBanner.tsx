/**
 * PRBanner — collapsible inline banner for a pull request that touches
 * the current document (FR cpt-cyberwiki-fr-inline-pending-changes).
 * Shows PR number, title, author, state, and an expandable diff preview.
 *
 * Ported from doclab components/main-view/content/PRBanner.tsx.
 */

import { useState } from 'react';
import { GitPullRequest, ChevronDown, ChevronRight } from 'lucide-react';
import type { DiffHunk } from '@/app/api';

interface PRBannerProps {
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prState: string;
  prUrl?: string;
  diffHunks?: DiffHunk[];
}

const STATE_BADGE_CLASSES: Record<string, string> = {
  open: 'bg-green-600 text-white',
  merged: 'bg-violet-600 text-white',
  closed: 'bg-red-600 text-white',
};

function stateBadgeClasses(prState: string): string {
  return STATE_BADGE_CLASSES[prState.toLowerCase()] ?? 'bg-muted text-muted-foreground';
}

function HunkLine({ line }: { line: string }) {
  const isAddition = line.startsWith('+');
  const isDeletion = line.startsWith('-');
  const cls = isAddition
    ? 'bg-green-100 text-green-900 dark:bg-green-950/30 dark:text-green-200'
    : isDeletion
      ? 'bg-red-100 text-red-900 dark:bg-red-950/30 dark:text-red-200'
      : 'text-foreground';
  return <div className={`px-3 py-0.5 ${cls}`}>{line}</div>;
}

export function PRBanner({
  prNumber,
  prTitle,
  prAuthor,
  prState,
  prUrl,
  diffHunks,
}: PRBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDiffHunks = !!diffHunks && diffHunks.length > 0;

  return (
    <div className="mb-2 rounded border border-border bg-muted overflow-hidden">
      <div
        className={`flex items-center gap-2 px-3 py-2 ${hasDiffHunks ? 'cursor-pointer hover:bg-accent/50' : ''}`}
        onClick={() => {
          if (hasDiffHunks) setIsExpanded((v) => !v);
        }}
      >
        {hasDiffHunks && (
          <button
            type="button"
            className="p-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((v) => !v);
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <GitPullRequest size={14} className="text-muted-foreground" />
        {prUrl ? (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sm text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            PR #{prNumber}
          </a>
        ) : (
          <span className="font-semibold text-sm text-primary">PR #{prNumber}</span>
        )}
        <span className="flex-1 text-sm overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
          {prTitle}
        </span>
        {hasDiffHunks && (
          <span className="text-xs px-2 py-0.5 rounded bg-background text-muted-foreground">
            {diffHunks.length} {diffHunks.length === 1 ? 'change' : 'changes'}
          </span>
        )}
        {prAuthor && (
          <span className="text-xs text-muted-foreground">by {prAuthor}</span>
        )}
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${stateBadgeClasses(prState)}`}
        >
          {prState}
        </span>
      </div>

      {isExpanded && hasDiffHunks && (
        <div className="border-t border-border">
          {diffHunks.map((hunk, index) => (
            <div key={index} className="border-b last:border-b-0 border-border">
              <div className="px-3 py-1 text-xs font-mono bg-background text-muted-foreground">
                @@ -{hunk.old_start},{hunk.old_count} +{hunk.new_start},{hunk.new_count} @@
              </div>
              <div className="font-mono text-xs">
                {hunk.lines.map((line, lineIndex) => (
                  <HunkLine key={lineIndex} line={line} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
