/**
 * CodeBlock
 *
 * Syntax-highlighted code block using react-syntax-highlighter.
 * Wraps Prism highlighter with theme-aware dark/light switching.
 * Inline styles are allowed here per project rules (components/primitives/).
 */

import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  content: string;
  language: string;
  showLineNumbers?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  content,
  language,
  showLineNumbers = true,
}) => {
  const isDark = useMemo(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
    [],
  );

  return (
    <SyntaxHighlighter
      language={language}
      style={isDark ? oneDark : oneLight}
      showLineNumbers={showLineNumbers}
      wrapLongLines
      customStyle={{
        margin: 0,
        borderRadius: 0,
        fontSize: '0.8125rem',
        lineHeight: '1.625',
      }}
    >
      {content}
    </SyntaxHighlighter>
  );
};
