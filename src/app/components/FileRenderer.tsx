/**
 * FileRenderer
 *
 * Standalone renderer for file content. Handles Markdown preview (with GFM),
 * syntax-highlighted code preview via react-syntax-highlighter, and plain
 * source view. Used directly in FileViewer, independent of MFE/enrichments.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/app/components/ui/code-block';
import {
  FileViewMode,
  FileType,
  detectFileType,
  getLanguageLabel,
} from '@/app/api/wikiTypes';

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
}

// ─── Source View (line numbers, no highlighting) ─────────────────────────────

interface SourceViewProps {
  content: string;
  selectedLines?: { start: number; end: number } | null;
  onLineClick?: (line: number, opts?: { shift?: boolean }) => void;
}

const SourceView: React.FC<SourceViewProps> = ({ content, selectedLines, onLineClick }) => {
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
            const rowCls = onLineClick ? 'cursor-pointer' : '';
            const stateCls = isSelected ? 'bg-primary/10' : 'hover:bg-accent/30';
            return (
              <tr
                key={i}
                onClick={(e) => onLineClick?.(lineNum, { shift: e.shiftKey })}
                className={`${rowCls} ${stateCls} group`}
              >
                <td
                  className={`select-none text-right pr-4 pl-4 align-top border-r border-border min-w-12 ${
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
}) => {
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
        return (
          <div
            key={`${block.startLine}-${block.endLine}`}
            data-line-start={block.startLine}
            data-line-end={block.endLine}
            onClick={(e) => onLineClick(block.startLine, { shift: e.shiftKey })}
            className={`cursor-pointer rounded -mx-2 px-2 py-0.5 transition-colors ${
              isSelected ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accent/40'
            }`}
            title={`Lines ${block.startLine}–${block.endLine} — click to comment, Shift+click to extend range`}
          >
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
}) => {
  if (mode === FileViewMode.Source) {
    return (
      <SourceView
        content={content}
        selectedLines={selectedLines}
        onLineClick={onLineClick}
      />
    );
  }

  const fileName = filePath.split('/').pop() || filePath;
  const fileType = detectFileType(fileName);

  if (fileType === FileType.Markdown) {
    return (
      <MarkdownPreview
        content={content}
        selectedLines={selectedLines}
        onLineClick={onLineClick}
      />
    );
  }

  // YAML, Code, and other non-markdown files — syntax-highlighted preview
  const language = getLanguageLabel(fileName);
  return <CodeBlock content={content} language={language} />;
};

export default FileRenderer;
