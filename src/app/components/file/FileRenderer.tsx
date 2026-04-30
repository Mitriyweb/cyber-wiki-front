/**
 * FileRenderer
 *
 * Standalone renderer for file content. Handles Markdown preview (with GFM),
 * syntax-highlighted code preview via react-syntax-highlighter, and plain
 * source view. Used directly in FileViewer, independent of MFE/enrichments.
 */

import React, { Suspense, lazy } from 'react';
import { useTranslation } from '@cyberfabric/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare } from 'lucide-react';
import { CodeBlock } from '@/app/components/primitives/CodeBlock';
import { ViewLoadingFallback } from '@/app/components/loading/ViewLoadingFallback';
import {
  FileViewMode,
  FileType,
  detectFileType,
  getLanguageLabel,
} from '@/app/api/wikiTypes';

// Monaco-backed read-only viewer; lazy-loaded so the ~3-4 MB monaco bundle
// only ships when the user actually opens a non-markdown file.
const CodeViewer = lazy(() => import('@/app/components/primitives/CodeViewer'));

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileRendererProps {
  content: string;
  filePath: string;
  mode: FileViewMode;
  /** Line range currently selected for commenting (1-based). */
  selectedLines?: { start: number; end: number } | null;
  /** Click on a line selects it for commenting. `opts.shift` extends the
   *  existing range; plain click anchors a single-line range. */
  onLineClick?: (line: number, opts?: { shift?: boolean }) => void;
  /** Lines (1-based) that have at least one comment anchored to them. */
  commentLines?: Set<number>;
  /** Lines (1-based) that differ from the on-disk version (unsaved draft). */
  changedLines?: Set<number>;
}

// ─── Source View (line numbers, no highlighting) ─────────────────────────────

interface SourceViewProps {
  content: string;
  selectedLines?: { start: number; end: number } | null;
  onLineClick?: (line: number, opts?: { shift?: boolean }) => void;
  commentLines?: Set<number>;
  changedLines?: Set<number>;
}

const SourceView: React.FC<SourceViewProps> = ({
  content,
  selectedLines,
  onLineClick,
  commentLines,
  changedLines,
}) => {
  const { t } = useTranslation();
  const lines = content.split('\n');
  return (
    <div className="font-mono text-sm leading-relaxed">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const isSelected =
              !!selectedLines &&
              lineNum >= selectedLines.start &&
              lineNum <= selectedLines.end;
            const hasComment = commentLines?.has(lineNum) ?? false;
            const isChanged = changedLines?.has(lineNum) ?? false;
            const rowCls = onLineClick ? 'cursor-pointer' : '';
            // Selection wins over change-tint so the active range is always
            // the most prominent cue.
            const stateCls = isSelected
              ? 'bg-primary/10'
              : isChanged
                ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                : 'hover:bg-accent/30';
            return (
              <tr
                key={i}
                onClick={(e) => onLineClick?.(lineNum, { shift: e.shiftKey })}
                className={`${rowCls} ${stateCls} group`}
              >
                {/* Marker gutter: comment icon and/or change bar. Tiny — leaves
                    space when there's nothing so line numbers don't shift. */}
                <td
                  className="select-none align-top w-6 px-1 text-center"
                  title={
                    hasComment && isChanged
                      ? t('fileRenderer.hasCommentAndModified')
                      : hasComment
                        ? t('fileRenderer.hasComment')
                        : isChanged
                          ? t('fileRenderer.modified')
                          : undefined
                  }
                >
                  <div className="flex items-center justify-center gap-0.5 pt-0.5">
                    {isChanged && (
                      <span
                        className="inline-block w-1 h-3 rounded-sm bg-yellow-500"
                        aria-label={t('fileRenderer.modified')}
                      />
                    )}
                    {hasComment && (
                      <MessageSquare
                        size={10}
                        className="text-blue-500"
                        aria-label={t('fileRenderer.hasComment')}
                      />
                    )}
                  </div>
                </td>
                <td
                  className={`select-none text-right pr-4 pl-2 align-top border-r border-border min-w-12 ${
                    isSelected
                      ? 'bg-primary/20 text-primary font-semibold'
                      : 'bg-muted text-muted-foreground/50'
                  }`}
                >
                  {lineNum}
                </td>
                <td className="pl-4 pr-4 whitespace-pre-wrap break-all align-top">
                  {line || '\n'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Markdown Preview ────────────────────────────────────────────────────────

interface MarkdownBlock {
  startLine: number; // 1-based
  endLine: number;
  text: string;
}

/**
 * Split markdown content into top-level blocks (separated by blank lines),
 * tracking the original source line range. Code fences are kept intact.
 */
function splitMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split('\n');
  const blocks: MarkdownBlock[] = [];
  let buffer: string[] = [];
  let blockStart = 1;
  let inFence = false;
  let currentLine = 0;

  const flush = (endLine: number) => {
    if (buffer.length === 0) return;
    blocks.push({ startLine: blockStart, endLine, text: buffer.join('\n') });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    currentLine = i + 1;
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
    }
    if (line.trim() === '' && !inFence) {
      // Blank line ends the current block (only when not inside a fence).
      if (buffer.length > 0) {
        flush(currentLine - 1);
      }
      // Next non-blank line will reset blockStart.
      blockStart = currentLine + 1;
    } else {
      if (buffer.length === 0) {
        blockStart = currentLine;
      }
      buffer.push(line);
    }
  }
  flush(currentLine);
  return blocks;
}

interface MarkdownPreviewProps {
  content: string;
  selectedLines?: { start: number; end: number } | null;
  onLineClick?: (line: number, opts?: { shift?: boolean }) => void;
  commentLines?: Set<number>;
  changedLines?: Set<number>;
}

/** Returns true if any line in [start, end] is in `lines`. */
function rangeIntersects(lines: Set<number> | undefined, start: number, end: number): boolean {
  if (!lines) return false;
  for (let n = start; n <= end; n++) {
    if (lines.has(n)) return true;
  }
  return false;
}

const MARKDOWN_COMPONENTS = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || '');
    const text = String(children).replace(/\n$/, '');
    if (match) {
      return <CodeBlock content={text} language={match[1]} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
} as const;

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  selectedLines,
  onLineClick,
  commentLines,
  changedLines,
}) => {
  const { t } = useTranslation();
  // When no click handler, render the whole content in a single ReactMarkdown
  // call — preserves block-spanning constructs (lists, blockquotes) better.
  if (!onLineClick) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none px-6 py-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  const blocks = splitMarkdownBlocks(content);
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none px-6 py-4">
      {blocks.map((block) => {
        const isSelected =
          !!selectedLines &&
          // Block intersects selected line range.
          block.endLine >= selectedLines.start &&
          block.startLine <= selectedLines.end;
        const hasComment = rangeIntersects(commentLines, block.startLine, block.endLine);
        const isChanged = rangeIntersects(changedLines, block.startLine, block.endLine);
        // No per-block yellow ring/tint: a single changed line inside a
        // multi-line block would otherwise paint the whole paragraph yellow
        // and the page reads as "everything changed". The thin margin bar
        // (rendered below) is enough of a hint.
        const stateCls = isSelected
          ? 'bg-primary/10 ring-1 ring-primary/40'
          : 'hover:bg-accent/40';
        return (
          <div
            key={`${block.startLine}-${block.endLine}`}
            data-line-start={block.startLine}
            data-line-end={block.endLine}
            onClick={(e) => onLineClick(block.startLine, { shift: e.shiftKey })}
            className={`relative cursor-pointer rounded -mx-2 px-2 py-0.5 transition-colors ${stateCls}`}
            title={t('fileRenderer.blockTitle', { start: block.startLine, end: block.endLine })}
          >
            {/* Block-level markers in the left margin. */}
            {(hasComment || isChanged) && (
              <div className="absolute -left-4 top-1 flex flex-col items-center gap-0.5">
                {isChanged && (
                  <span
                    className="block w-1 h-3 rounded-sm bg-yellow-500"
                    aria-label={t('fileRenderer.modified')}
                    title={t('fileRenderer.modified')}
                  />
                )}
                {hasComment && (
                  <MessageSquare size={11} className="text-blue-500" aria-label={t('fileRenderer.hasComment')} />
                )}
              </div>
            )}
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
              {block.text}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
};

// ─── FileRenderer ────────────────────────────────────────────────────────────

const FileRenderer: React.FC<FileRendererProps> = ({
  content,
  filePath,
  mode,
  selectedLines,
  onLineClick,
  commentLines,
  changedLines,
}) => {
  const fileName = filePath.split('/').pop() || filePath;
  const fileType = detectFileType(fileName);
  const isMarkdown = fileType === FileType.Markdown;
  const language = getLanguageLabel(fileName);

  // Non-markdown: Monaco is *the* render — syntax highlighting, folding, glyph
  // margins for comments, change-bar decorations. There's no "raw vs render"
  // distinction worth surfacing (Monaco renders plain text fine when the
  // language is unknown), so both Source and Preview converge here.
  if (!isMarkdown) {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <CodeViewer
          value={content}
          language={language}
          selectedLines={selectedLines}
          onLineClick={onLineClick}
          commentLines={commentLines}
          changedLines={changedLines}
        />
      </Suspense>
    );
  }

  // Markdown: real raw-vs-render split. Source = line-numbered table for
  // per-line commenting; Preview = rendered HTML via remark.
  if (mode === FileViewMode.Source) {
    return (
      <SourceView
        content={content}
        selectedLines={selectedLines}
        onLineClick={onLineClick}
        commentLines={commentLines}
        changedLines={changedLines}
      />
    );
  }
  return (
    <MarkdownPreview
      content={content}
      selectedLines={selectedLines}
      onLineClick={onLineClick}
      commentLines={commentLines}
      changedLines={changedLines}
    />
  );
};

export default FileRenderer;
