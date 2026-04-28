/**
 * DiffViewer — unified / split diff view for a single DiffEnrichment.
 *
 * Per FR cpt-cyberwiki-fr-change-history. Expandable hunks, +N/-N stats,
 * optional accept/reject hooks (currently no-op until P3 wiring).
 *
 * Ported from doclab components/main-view/sidebar/DiffViewer.tsx.
 */

import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import type { DiffEnrichment, DiffHunk } from '@/app/api';

enum DiffLineKind {
  Add = 'add',
  Delete = 'delete',
  Context = 'context',
}

interface ParsedLine {
  kind: DiffLineKind;
  content: string;
}

function parseLine(raw: string): ParsedLine {
  if (raw.startsWith('+')) return { kind: DiffLineKind.Add, content: raw.slice(1) };
  if (raw.startsWith('-')) return { kind: DiffLineKind.Delete, content: raw.slice(1) };
  return { kind: DiffLineKind.Context, content: raw.replace(/^ /, '') };
}

enum DiffViewMode {
  Unified = 'unified',
  Split = 'split',
}

interface DiffViewerProps {
  diff: DiffEnrichment;
  fileName: string;
  onAccept?: (diffId: string) => void;
  onReject?: (diffId: string) => void;
}

export function DiffViewer({ diff, fileName, onAccept, onReject }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>(DiffViewMode.Unified);
  const [expandedHunks, setExpandedHunks] = useState<Set<number>>(new Set([0]));

  const toggleHunk = (index: number) => {
    setExpandedHunks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{fileName}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              {diff.status}
            </span>
          </div>
          {diff.description && (
            <div className="text-sm mt-1 text-muted-foreground">{diff.description}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-sm mr-4">
            <span className="text-green-600">+{diff.stats.additions}</span>
            <span className="text-red-600">-{diff.stats.deletions}</span>
          </div>

          <div className="flex rounded overflow-hidden border border-border">
            <button
              type="button"
              onClick={() => setViewMode(DiffViewMode.Unified)}
              className={`px-3 py-1 text-xs ${viewMode === DiffViewMode.Unified ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'}`}
            >
              Unified
            </button>
            <button
              type="button"
              onClick={() => setViewMode(DiffViewMode.Split)}
              className={`px-3 py-1 text-xs border-l border-border ${viewMode === DiffViewMode.Split ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'}`}
            >
              Split
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExpandedHunks(new Set(diff.diff_hunks.map((_, i) => i)))}
            className="px-2 py-1 text-xs text-muted-foreground hover:opacity-80"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={() => setExpandedHunks(new Set())}
            className="px-2 py-1 text-xs text-muted-foreground hover:opacity-80"
          >
            Collapse All
          </button>

          {onAccept && (
            <button
              type="button"
              onClick={() => onAccept(diff.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
            >
              <Check size={16} />
              Accept
            </button>
          )}
          {onReject && (
            <button
              type="button"
              onClick={() => onReject(diff.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <X size={16} />
              Reject
            </button>
          )}
        </div>
      </div>

      {/* Hunks */}
      <div>
        {diff.diff_hunks.map((hunk, index) => (
          <DiffHunkView
            key={index}
            hunk={hunk}
            index={index}
            isExpanded={expandedHunks.has(index)}
            viewMode={viewMode}
            onToggle={() => toggleHunk(index)}
          />
        ))}
      </div>
    </div>
  );
}

interface DiffHunkViewProps {
  hunk: DiffHunk;
  index: number;
  isExpanded: boolean;
  viewMode: DiffViewMode;
  onToggle: () => void;
}

function DiffHunkView({ hunk, index, isExpanded, viewMode, onToggle }: DiffHunkViewProps) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 text-muted-foreground bg-muted hover:opacity-80"
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="font-mono text-xs">
          @@ -{hunk.old_start},{hunk.old_count} +{hunk.new_start},{hunk.new_count} @@
        </span>
        <span className="text-xs ml-2">
          Hunk {index + 1} ({hunk.lines.length} lines)
        </span>
      </button>

      {isExpanded && (
        <div className="font-mono text-sm">
          {viewMode === DiffViewMode.Unified ? (
            <UnifiedDiffView hunk={hunk} />
          ) : (
            <SplitDiffView hunk={hunk} />
          )}
        </div>
      )}
    </div>
  );
}

function rowBgClass(kind: DiffLineKind): string {
  if (kind === DiffLineKind.Add) {
    return 'bg-green-100 dark:bg-green-950/30';
  }
  if (kind === DiffLineKind.Delete) {
    return 'bg-red-100 dark:bg-red-950/30';
  }
  return '';
}

function textColorClass(kind: DiffLineKind): string {
  if (kind === DiffLineKind.Add) return 'text-green-800 dark:text-green-200';
  if (kind === DiffLineKind.Delete) return 'text-red-800 dark:text-red-200';
  return 'text-foreground';
}

function UnifiedDiffView({ hunk }: { hunk: DiffHunk }) {
  let oldLineNum = hunk.old_start;
  let newLineNum = hunk.new_start;

  return (
    <div>
      {hunk.lines.map((raw, index) => {
        const line = parseLine(raw);
        const currentOld = line.kind !== DiffLineKind.Add ? oldLineNum++ : null;
        const currentNew = line.kind !== DiffLineKind.Delete ? newLineNum++ : null;
        const prefix =
          line.kind === DiffLineKind.Add ? '+' : line.kind === DiffLineKind.Delete ? '-' : ' ';
        return (
          <div key={index} className={`flex ${rowBgClass(line.kind)}`}>
            <span className="px-2 text-right select-none w-12 text-muted-foreground/60">
              {currentOld ?? ''}
            </span>
            <span className="px-2 text-right select-none w-12 border-r border-border text-muted-foreground/60">
              {currentNew ?? ''}
            </span>
            <span className={`px-2 ${textColorClass(line.kind)}`}>{prefix}</span>
            <span className={`flex-1 pr-4 whitespace-pre-wrap break-all ${textColorClass(line.kind)}`}>
              {line.content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SplitDiffView({ hunk }: { hunk: DiffHunk }) {
  const parsed = hunk.lines.map(parseLine);
  const pairs: Array<{ old: ParsedLine | null; new: ParsedLine | null }> = [];

  let i = 0;
  while (i < parsed.length) {
    const line = parsed[i];
    if (line.kind === DiffLineKind.Context) {
      pairs.push({ old: line, new: line });
      i++;
      continue;
    }
    if (line.kind === DiffLineKind.Delete) {
      let j = i + 1;
      while (j < parsed.length && parsed[j].kind === DiffLineKind.Delete) j++;
      if (j < parsed.length && parsed[j].kind === DiffLineKind.Add) {
        pairs.push({ old: parsed[i], new: parsed[j] });
        i = j + 1;
      } else {
        pairs.push({ old: parsed[i], new: null });
        i++;
      }
      continue;
    }
    pairs.push({ old: null, new: line });
    i++;
  }

  let oldLineNum = hunk.old_start;
  let newLineNum = hunk.new_start;

  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      {/* Old side */}
      <div>
        {pairs.map((pair, idx) => {
          const line = pair.old;
          const num = line && line.kind !== DiffLineKind.Add ? oldLineNum++ : null;
          const prefix = line?.kind === DiffLineKind.Delete ? '-' : line ? ' ' : '';
          return (
            <div
              key={`old-${idx}`}
              className={`flex min-h-6 ${line ? rowBgClass(line.kind === DiffLineKind.Add ? DiffLineKind.Context : line.kind) : ''}`}
            >
              <span className="px-2 text-right select-none w-12 text-muted-foreground/60">
                {num ?? ''}
              </span>
              <span className={`px-2 ${line ? textColorClass(line.kind) : ''}`}>{prefix}</span>
              <span
                className={`flex-1 pr-4 whitespace-pre-wrap break-all ${line ? textColorClass(line.kind) : ''}`}
              >
                {line?.content ?? ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* New side */}
      <div>
        {pairs.map((pair, idx) => {
          const line = pair.new;
          const num = line && line.kind !== DiffLineKind.Delete ? newLineNum++ : null;
          const prefix = line?.kind === DiffLineKind.Add ? '+' : line ? ' ' : '';
          return (
            <div
              key={`new-${idx}`}
              className={`flex min-h-6 ${line ? rowBgClass(line.kind === DiffLineKind.Delete ? DiffLineKind.Context : line.kind) : ''}`}
            >
              <span className="px-2 text-right select-none w-12 text-muted-foreground/60">
                {num ?? ''}
              </span>
              <span className={`px-2 ${line ? textColorClass(line.kind) : ''}`}>{prefix}</span>
              <span
                className={`flex-1 pr-4 whitespace-pre-wrap break-all ${line ? textColorClass(line.kind) : ''}`}
              >
                {line?.content ?? ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
