/**
 * Register custom Monaco languages that ship outside its built-in set
 * (TOML being the immediate need for the wiki workspace config). Idempotent
 * via a module-level flag so calling it from every editor's onMount is safe.
 *
 * Add new languages here as the need surfaces; this is the single place we
 * touch `monaco.languages.register*`.
 */

import type * as MonacoNs from 'monaco-editor';

let registered = false;

export function ensureLanguagesRegistered(monaco: typeof MonacoNs): void {
  if (registered) return;
  registered = true;
  registerToml(monaco);
}

/** Minimal TOML monarch grammar — covers tables, inline tables, arrays,
 *  strings (single / double / triple-quoted), comments, datetimes, numbers,
 *  and the `true`/`false` keywords. Not a full TOML 1.0 parser, but enough
 *  for syntax highlighting in the editor. */
function registerToml(monaco: typeof MonacoNs): void {
  const id = 'toml';
  monaco.languages.register({
    id,
    extensions: ['.toml'],
    aliases: ['TOML', 'toml'],
  });

  monaco.languages.setLanguageConfiguration(id, {
    comments: { lineComment: '#' },
    brackets: [
      ['[', ']'],
      ['{', '}'],
    ],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  monaco.languages.setMonarchTokensProvider(id, {
    defaultToken: '',
    tokenPostfix: '.toml',
    tokenizer: {
      root: [
        // [[array.of.tables]] — match before single-bracket sections.
        [/^\s*(\[\[)([^\]\n]+?)(\]\])/, ['delimiter.bracket', 'metatag', 'delimiter.bracket']],
        // [section] / [a.b.c]
        [/^\s*(\[)([^\]\n]+?)(\])/, ['delimiter.bracket', 'metatag', 'delimiter.bracket']],
        // Comment to end of line.
        [/#.*$/, 'comment'],
        // Bare key (TOML allows quoted keys too — handled by the string rules below).
        [/[A-Za-z_][\w-]*(?=\s*=)/, 'attribute.name'],
        [/=/, 'delimiter'],
        // Booleans.
        [/\b(?:true|false)\b/, 'keyword'],
        // RFC 3339 datetimes / dates / times.
        [/\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/, 'number.date'],
        [/\d{2}:\d{2}:\d{2}(?:\.\d+)?/, 'number.date'],
        // Numbers (int with underscores, hex/oct/bin, float, exp, +/-/inf/nan).
        [/[+-]?(?:inf|nan)\b/, 'number.float'],
        [/[+-]?0x[0-9a-fA-F_]+/, 'number.hex'],
        [/[+-]?0o[0-7_]+/, 'number.octal'],
        [/[+-]?0b[01_]+/, 'number.binary'],
        [/[+-]?\d[\d_]*\.\d[\d_]*(?:[eE][+-]?\d+)?/, 'number.float'],
        [/[+-]?\d[\d_]*(?:[eE][+-]?\d+)?/, 'number'],
        // Strings — triple-quoted before single so the longer match wins.
        [/"""/, { token: 'string.quote', next: '@mlString' }],
        [/'''/, { token: 'string.quote', next: '@mlLiteral' }],
        [/"/, { token: 'string.quote', next: '@string' }],
        [/'/, { token: 'string.quote', next: '@literal' }],
        // Structural delimiters.
        [/[[\]{},]/, 'delimiter'],
      ],
      string: [
        [/[^"\\]+/, 'string'],
        [/\\(?:["\\bfnrt/]|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', next: '@pop' }],
      ],
      literal: [
        [/[^']+/, 'string'],
        [/'/, { token: 'string.quote', next: '@pop' }],
      ],
      mlString: [
        [/[^"\\]+/, 'string'],
        [/\\(?:["\\bfnrt/]|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|\s)/, 'string.escape'],
        [/"""/, { token: 'string.quote', next: '@pop' }],
        [/"/, 'string'],
      ],
      mlLiteral: [
        [/[^']+/, 'string'],
        [/'''/, { token: 'string.quote', next: '@pop' }],
        [/'/, 'string'],
      ],
    },
  });
}
