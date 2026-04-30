/**
 * CodeEditor — editable Monaco editor for non-Markdown files (code, YAML,
 * TOML, JSON, plain text). Replaces the bare `<textarea>` previously used in
 * FileViewer's edit mode so users get syntax highlighting, line numbers,
 * folding, and bracket matching.
 *
 * Default-exported because it's `React.lazy`-loaded by FileViewer to keep
 * Monaco (~3-4 MB) out of the initial bundle.
 */

import React, { useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useMonacoTheme } from './useMonacoTheme';
import { ensureLanguagesRegistered } from './monacoSetup';

interface CodeEditorProps {
  value: string;
  /** Monaco language id (e.g. 'typescript', 'json', 'yaml', 'toml'). Pass
   *  `getLanguageLabel(fileName)` from `@/app/api/wikiTypes`. Falls back to
   *  Monaco's `'plaintext'` when unknown. */
  language: string;
  onChange: (value: string) => void;
  /** Auto-focus on mount. Defaults to true to match the textarea it
   *  replaces, where the user expected to start typing immediately. */
  autoFocus?: boolean;
}

const FONT_FAMILY =
  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, SFMono-Regular, monospace";

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  onChange,
  autoFocus = true,
}) => {
  const theme = useMonacoTheme();

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      // Register custom languages (TOML etc.) before binding the model so
      // the tokenizer is in place when Monaco runs its first tokenization.
      ensureLanguagesRegistered(monaco);
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, language);

      editor.updateOptions({
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        folding: true,
        fontSize: 13,
        fontFamily: FONT_FAMILY,
        tabSize: 2,
        renderWhitespace: 'selection',
      });
      if (autoFocus) editor.focus();
    },
    [autoFocus, language],
  );

  const handleChange = useCallback(
    (next: string | undefined) => {
      if (next !== undefined) onChange(next);
    },
    [onChange],
  );

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      theme={theme}
    />
  );
};

export default CodeEditor;
