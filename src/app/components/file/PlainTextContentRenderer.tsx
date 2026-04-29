/**
 * PlainTextContentRenderer
 *
 * Renders virtual content with dual line numbers (original + virtual),
 * diff highlighting (additions/deletions), inline badges
 * (comments, PR, commit, edit), conflict dialog, and edit mode.
 * Ported from doclab PlainTextContentRenderer.
 */

import { useState, useRef, useEffect } from 'react';
import { Pencil, GitCommit, AlertTriangle, MessageSquare } from 'lucide-react';
import {
  DiffType,
  EnrichmentType,
  type VirtualLine,
  type LayeredVirtualContent,
  type Enrichment,
} from '@/app/api/wikiTypes';
import { ConflictDetailsDialog } from '@/app/components/enrichments/ConflictDetailsDialog';

interface PlainTextContentRendererProps {
  virtualContent: LayeredVirtualContent;
  onLineClick?: (lineNumber: number) => void;
  onEnrichmentClick?: (enrichment: Enrichment) => void;
  isEditMode?: boolean;
  onLineContentChange?: (virtualLineNumber: number, newContent: string) => void;
}

// Editable line component used in edit mode.
function EditableLine({
  content,
  virtualLineNumber,
  className,
  onContentChange,
}: {
  content: string;
  virtualLineNumber: number;
  className?: string;
  onContentChange: (virtualLineNumber: number, newContent: string) => void;
}) {
  const ref = useRef<HTMLPreElement>(null);
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (ref.current && !isEditingRef.current) {
      ref.current.innerText = content;
    }
  }, [content]);

  return (
    <pre
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`${className ?? ''} outline-none cursor-text min-h-[1.2em]`}
      onFocus={() => { isEditingRef.current = true; }}
      onBlur={() => { isEditingRef.current = false; }}
      onInput={e => {
        const text = e.currentTarget.innerText.replace(/\n$/, '');
        onContentChange(virtualLineNumber, text);
      }}
    />
  );
}

function countCommentsRecursively(comments: Enrichment[]): number {
  return comments.reduce((count, c) => {
    const data = c.data as Record<string, Enrichment[]>;
    const replies = data.replies ?? [];
    return count + 1 + countCommentsRecursively(replies);
  }, 0);
}

function PlainTextContentRenderer({
  virtualContent,
  onLineClick,
  onEnrichmentClick,
  isEditMode,
  onLineContentChange,
}: PlainTextContentRendererProps) {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [conflictDialog, setConflictDialog] = useState<{
    conflicts: Enrichment[];
    initialIndex: number;
  } | null>(null);
  const { finalLines } = virtualContent;

  const renderLine = (vLine: VirtualLine) => {
    const isDeletion = vLine.diffType === DiffType.Deletion;
    const isAddition = vLine.diffType === DiffType.Addition;

    const commentEnrichments = vLine.enrichments.filter((e) => e.type === EnrichmentType.Comment);
    const conflictEnrichments = vLine.enrichments.filter((e) => e.type === 'conflict');
    const firstLineConflicts = conflictEnrichments.filter((ce) => vLine.lineNumber === ce.lineStart);

    let bgClass = '';
    if (conflictEnrichments.length > 0) {
      bgClass = 'bg-orange-50 dark:bg-orange-950/20';
    } else if (isDeletion) {
      bgClass = 'bg-red-100 dark:bg-red-950/30';
    } else if (isAddition) {
      bgClass = 'bg-green-100 dark:bg-green-950/30';
    }

    const showPRBadge = !!(vLine.prNumber && vLine.isFirstInDiffGroup);
    const showCommitBadge = !!(vLine.commitSha && vLine.isFirstInDiffGroup);
    const showEditBadge = !!(vLine.editId && vLine.isFirstInDiffGroup);

    const hasBadges =
      commentEnrichments.length > 0 ||
      firstLineConflicts.length > 0 ||
      showPRBadge ||
      showCommitBadge ||
      showEditBadge;

    const isHovered = hoveredLine === vLine.virtualLineNumber;

    // Editable in edit mode: original lines that are not deletions, and edit-session inserted lines
    const isEditable = !!(
      isEditMode &&
      !isDeletion &&
      (!vLine.isInsertedLine || vLine.sourceEnrichment?.type === EnrichmentType.Edit)
    );

    return (
      <div
        key={vLine.virtualLineNumber}
        className={`flex items-start group ${bgClass} ${isHovered && !bgClass ? 'bg-accent/30' : ''}`}
        onClick={!isEditMode ? () => onLineClick?.(vLine.lineNumber) : undefined}
        onMouseEnter={() => setHoveredLine(vLine.virtualLineNumber)}
        onMouseLeave={() => setHoveredLine(null)}
      >
        {/* Original line number */}
        <div className="w-12 flex-shrink-0 px-2 text-right text-xs select-none border-r border-border text-muted-foreground/50 font-mono leading-relaxed">
          {vLine.isOriginalLine ? vLine.lineNumber : ''}
        </div>
        {/* Virtual line number */}
        <div className="w-12 flex-shrink-0 px-2 text-right text-xs select-none border-r border-border text-muted-foreground/30 font-mono leading-relaxed">
          {vLine.virtualLineNumber}
        </div>

        {/* Content + badges */}
        <div className="flex-1 px-4 py-0.5 flex items-start gap-4 min-w-0">
          {isEditable ? (
            <EditableLine
              content={vLine.content}
              virtualLineNumber={vLine.virtualLineNumber}
              className="flex-1 m-0 whitespace-pre-wrap break-words text-sm min-w-0 font-mono leading-relaxed"
              onContentChange={onLineContentChange!}
            />
          ) : (
            <pre className="flex-1 m-0 whitespace-pre-wrap break-words text-sm min-w-0 font-mono leading-relaxed">
              {vLine.content}
            </pre>
          )}

          {hasBadges && (
            <div className="flex-shrink-0 flex items-center gap-1.5 pt-0.5">
              {/* Comment badge */}
              {commentEnrichments.length > 0 && (
                <button
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnrichmentClick?.(commentEnrichments[0]);
                  }}
                >
                  <MessageSquare size={10} />
                  {countCommentsRecursively(commentEnrichments)}
                </button>
              )}

              {/* Conflict badge */}
              {firstLineConflicts.length > 0 && (
                <button
                  className="inline-flex items-center justify-center gap-0.5 rounded border border-destructive bg-destructive/10 text-destructive min-w-[1.375rem] h-[1.375rem] text-[0.6875rem] font-semibold"
                  title={`${firstLineConflicts.length} conflict${firstLineConflicts.length > 1 ? 's' : ''} — click to review`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConflictDialog({ conflicts: firstLineConflicts, initialIndex: 0 });
                  }}
                >
                  <AlertTriangle size={12} />
                  {firstLineConflicts.length > 1 && <span>{firstLineConflicts.length}</span>}
                </button>
              )}

              {/* PR badge */}
              {showPRBadge && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                    isDeletion
                      ? 'bg-red-100 border-red-400 text-red-800 dark:bg-red-950/30 dark:border-red-600 dark:text-red-300'
                      : 'bg-green-100 border-green-400 text-green-800 dark:bg-green-950/30 dark:border-green-600 dark:text-green-300'
                  }`}
                >
                  PR #{vLine.prNumber}
                </span>
              )}

              {/* Commit badge */}
              {showCommitBadge && (
                <span
                  className="inline-flex items-center justify-center rounded border border-violet-400 bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:border-violet-600 dark:text-violet-300 w-[1.375rem] h-[1.375rem]"
                  title="Committed to branch"
                >
                  <GitCommit size={12} />
                </span>
              )}

              {/* Edit badge */}
              {showEditBadge && (
                <button
                  className="inline-flex items-center justify-center rounded border border-blue-400 bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:border-blue-600 dark:text-blue-300 w-[1.375rem] h-[1.375rem]"
                  title="Your draft change — click to view in Changes tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnrichmentClick?.({
                      type: 'edit',
                      id: vLine.editId || '',
                      lineStart: 0,
                      lineEnd: 0,
                      data: {},
                    });
                  }}
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="font-mono text-sm">{finalLines.map(renderLine)}</div>
      {conflictDialog && (
        <ConflictDetailsDialog
          conflicts={conflictDialog.conflicts}
          initialIndex={conflictDialog.initialIndex}
          onClose={() => setConflictDialog(null)}
        />
      )}
    </>
  );
}

export default PlainTextContentRenderer;
