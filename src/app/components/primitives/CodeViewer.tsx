/**
 * CodeViewer — read-only Monaco editor for non-Markdown files. Drop-in
 * replacement for the table-based `SourceView` in `FileRenderer.tsx`:
 * mirrors the same `selectedLines / commentLines / changedLines / onLineClick`
 * contract but renders with Monaco's syntax highlighting, folding, and
 * gutter so users can read code instead of a flat plain-text list.
 *
 * Default-exported because it's `React.lazy`-loaded by FileRenderer to keep
 * Monaco out of the initial bundle.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type * as MonacoNs from 'monaco-editor';
import { useMonacoTheme } from './useMonacoTheme';
import { ensureLanguagesRegistered } from './monacoSetup';

interface CodeViewerProps {
  value: string;
  /** Monaco language id; pass `getLanguageLabel(fileName)`. */
  language: string;
  /** Highlighted commit-comment selection (1-based, inclusive). */
  selectedLines?: { start: number; end: number } | null;
  /** Lines with at least one comment anchored — render a glyph-margin marker. */
  commentLines?: Set<number>;
  /** Lines that differ from the on-disk version (unsaved draft) — yellow bar. */
  changedLines?: Set<number>;
  /** Click on glyph margin / line number / line content. `opts.shift` extends
   *  the existing range. */
  onLineClick?: (line: number, opts?: { shift?: boolean }) => void;
}

const FONT_FAMILY =
  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, SFMono-Regular, monospace";

/** One-time injection of decoration styles. Allowed inside primitives/. */
const STYLE_ID = 'cw-code-viewer-styles';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .cw-changed-bar {
      background: hsl(var(--warning, 48 96% 50%) / 0.7);
      width: 3px !important;
      margin-left: 2px;
    }
    .cw-comment-glyph {
      background: hsl(var(--primary));
      border-radius: 50%;
      width: 8px !important;
      height: 8px !important;
      margin: 6px 0 0 6px;
    }
    .cw-selected-line {
      background: hsl(var(--primary) / 0.12);
    }
    .cw-changed-line {
      background: hsl(var(--warning, 48 96% 50%) / 0.06);
    }
  `;
  document.head.appendChild(style);
}

const CodeViewer: React.FC<CodeViewerProps> = ({
  value,
  language,
  selectedLines,
  commentLines,
  changedLines,
  onLineClick,
}) => {
  const theme = useMonacoTheme();
  const editorRef = useRef<MonacoNs.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<MonacoNs.editor.IEditorDecorationsCollection | null>(null);

  // Refs so the stable onMouseDown closure always reads fresh callbacks/data.
  const onLineClickRef = useRef(onLineClick);
  onLineClickRef.current = onLineClick;

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      ensureStyles();
      // Register custom languages (TOML etc.) before binding the model so
      // the tokenizer is in place when Monaco runs its first tokenization.
      ensureLanguagesRegistered(monaco);
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, language);

      editorRef.current = editor;
      monacoRef.current = monaco;
      editor.updateOptions({
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        folding: true,
        glyphMargin: true,
        renderLineHighlight: 'all',
        fontSize: 13,
        fontFamily: FONT_FAMILY,
      });

      // Click on glyph margin OR line numbers selects the line for commenting.
      // Shift-click extends the existing range (matches SourceView semantics).
      editor.onMouseDown((e) => {
        const t = e.target.type;
        const isGlyph = t === monaco.editor.MouseTargetType.GLYPH_MARGIN;
        const isLineNumber = t === monaco.editor.MouseTargetType.LINE_NUMBERS;
        if ((isGlyph || isLineNumber) && e.target.position) {
          const line = e.target.position.lineNumber;
          onLineClickRef.current?.(line, { shift: e.event.shiftKey });
        }
      });
    },
    [language],
  );

  // Apply / refresh decorations when the inputs change. The collection is
  // created lazily on the first effect run so we can reuse it across updates.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const decorations: MonacoNs.editor.IModelDeltaDecoration[] = [];

    if (selectedLines) {
      decorations.push({
        range: new monaco.Range(selectedLines.start, 1, selectedLines.end, 1),
        options: {
          isWholeLine: true,
          className: 'cw-selected-line',
        },
      });
    }

    if (changedLines) {
      for (const line of changedLines) {
        decorations.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'cw-changed-line',
            linesDecorationsClassName: 'cw-changed-bar',
          },
        });
      }
    }

    if (commentLines) {
      for (const line of commentLines) {
        decorations.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            glyphMarginClassName: 'cw-comment-glyph',
          },
        });
      }
    }

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection(decorations);
    } else {
      decorationsRef.current.set(decorations);
    }
  }, [selectedLines, commentLines, changedLines]);

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onMount={handleMount}
      theme={theme}
      options={{ readOnly: true }}
    />
  );
};

export default CodeViewer;
