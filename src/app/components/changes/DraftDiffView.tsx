/**
 * DraftDiffView — unified diff between the on-disk version of a file and
 * the user's pending draft. Lets the reader see *what* changed, not just
 * *where*. LCS-based, no external dependency.
 *
 * Output is a list of hunks; each hunk carries a few lines of context plus
 * the additions/deletions. Long unchanged stretches are collapsed.
 */

import React, { useMemo } from 'react';

interface DraftDiffViewProps {
  /** On-disk file content (the "before" side). */
  original: string;
  /** Pending draft content (the "after" side). */
  modified: string;
  /** Number of context lines around each change. */
  context?: number;
}

enum DiffOp {
  Equal = 'eq',
  Add = 'add',
  Del = 'del',
}

interface DiffLine {
  op: DiffOp;
  /** 1-based line number in the original (only set for Equal/Del). */
  oldLine?: number;
  /** 1-based line number in the modified (only set for Equal/Add). */
  newLine?: number;
  text: string;
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

/**
 * Compute a unified line-level diff via Longest Common Subsequence. For
 * extremely large files we bail out to a single "files differ" hunk so the
 * UI doesn't lock up. Memory budget is the same 25M cells used elsewhere.
 */
function computeDiff(original: string, modified: string): DiffLine[] {
  const a = original.replace(/\r\n?/g, '\n').split('\n');
  const b = modified.replace(/\r\n?/g, '\n').split('\n');
  const n = a.length;
  const m = b.length;
  if (n * m > 25_000_000) {
    // Punt: render as full delete + full insert.
    const lines: DiffLine[] = [];
    for (let i = 0; i < n; i++) lines.push({ op: DiffOp.Del, oldLine: i + 1, text: a[i] });
    for (let j = 0; j < m; j++) lines.push({ op: DiffOp.Add, newLine: j + 1, text: b[j] });
    return lines;
  }

  const dp: Uint32Array[] = Array.from(
    { length: n + 1 },
    () => new Uint32Array(m + 1),
  );
  for (let i = 1; i <= n; i++) {
    const ai = a[i - 1];
    const row = dp[i];
    const prev = dp[i - 1];
    for (let j = 1; j <= m; j++) {
      if (ai === b[j - 1]) {
        row[j] = prev[j - 1] + 1;
      } else {
        row[j] = prev[j] >= row[j - 1] ? prev[j] : row[j - 1];
      }
    }
  }

  // Backtrack from (n,m) to (0,0), prepending operations.
  const out: DiffLine[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ op: DiffOp.Equal, oldLine: i, newLine: j, text: a[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.push({ op: DiffOp.Del, oldLine: i, text: a[i - 1] });
      i--;
    } else {
      out.push({ op: DiffOp.Add, newLine: j, text: b[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    out.push({ op: DiffOp.Del, oldLine: i, text: a[i - 1] });
    i--;
  }
  while (j > 0) {
    out.push({ op: DiffOp.Add, newLine: j, text: b[j - 1] });
    j--;
  }
  return out.reverse();
}

/**
 * Group diff lines into hunks: every changed line plus `context` equal
 * lines on either side. Unchanged stretches longer than 2*context are
 * collapsed into a "@@" marker.
 */
function buildHunks(lines: DiffLine[], context: number): Hunk[] {
  const changedIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].op !== DiffOp.Equal) changedIdx.push(i);
  }
  if (changedIdx.length === 0) return [];

  // Merge overlapping context windows into hunks of [start, end] indices.
  const ranges: Array<[number, number]> = [];
  for (const idx of changedIdx) {
    const start = Math.max(0, idx - context);
    const end = Math.min(lines.length - 1, idx + context);
    if (ranges.length > 0 && start <= ranges[ranges.length - 1][1] + 1) {
      ranges[ranges.length - 1][1] = Math.max(ranges[ranges.length - 1][1], end);
    } else {
      ranges.push([start, end]);
    }
  }

  return ranges.map(([start, end]) => {
    const hunkLines = lines.slice(start, end + 1);
    let oldStart = 0;
    let oldCount = 0;
    let newStart = 0;
    let newCount = 0;
    for (const l of hunkLines) {
      if (l.op === DiffOp.Equal || l.op === DiffOp.Del) {
        if (oldStart === 0 && l.oldLine) oldStart = l.oldLine;
        oldCount++;
      }
      if (l.op === DiffOp.Equal || l.op === DiffOp.Add) {
        if (newStart === 0 && l.newLine) newStart = l.newLine;
        newCount++;
      }
    }
    return { oldStart, oldCount, newStart, newCount, lines: hunkLines };
  });
}

export const DraftDiffView: React.FC<DraftDiffViewProps> = ({
  original,
  modified,
  context = 3,
}) => {
  const hunks = useMemo(() => {
    const diff = computeDiff(original, modified);
    return buildHunks(diff, context);
  }, [original, modified, context]);

  if (original === modified) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        No differences between the on-disk file and your draft.
      </div>
    );
  }

  if (hunks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        No textual differences (whitespace-only change).
      </div>
    );
  }

  let additions = 0;
  let deletions = 0;
  for (const h of hunks) {
    for (const l of h.lines) {
      if (l.op === DiffOp.Add) additions++;
      else if (l.op === DiffOp.Del) deletions++;
    }
  }

  return (
    <div className="font-mono text-xs leading-relaxed">
      <div className="sticky top-0 z-10 px-3 py-1.5 bg-muted border-b border-border text-[0.7rem] flex items-center gap-3">
        <span className="text-green-700 dark:text-green-400">+{additions}</span>
        <span className="text-red-700 dark:text-red-400">-{deletions}</span>
        <span className="text-muted-foreground ml-auto">
          {hunks.length} {hunks.length === 1 ? 'hunk' : 'hunks'}
        </span>
      </div>
      {hunks.map((hunk, hi) => (
        <div key={hi} className="border-b border-border last:border-b-0">
          <div className="px-3 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[0.7rem]">
            @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
          </div>
          {hunk.lines.map((line, li) => {
            const cls =
              line.op === DiffOp.Add
                ? 'bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200'
                : line.op === DiffOp.Del
                  ? 'bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200'
                  : 'text-foreground';
            const sign = line.op === DiffOp.Add ? '+' : line.op === DiffOp.Del ? '-' : ' ';
            return (
              <div key={li} className={`flex ${cls}`}>
                <span className="select-none text-right pr-2 pl-3 w-12 flex-shrink-0 text-muted-foreground/60">
                  {line.oldLine ?? ''}
                </span>
                <span className="select-none text-right pr-2 w-12 flex-shrink-0 text-muted-foreground/60">
                  {line.newLine ?? ''}
                </span>
                <span className="select-none px-2 flex-shrink-0">{sign}</span>
                <span className="whitespace-pre-wrap break-all flex-1 pr-3">
                  {line.text || '\n'}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

DraftDiffView.displayName = 'DraftDiffView';
