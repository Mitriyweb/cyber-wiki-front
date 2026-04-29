/**
 * MdRenderer — Markdown WYSIWYG / source editor using Milkdown.
 *
 * Per FR cpt-cyberwiki-fr-live-edit (WYSIWYG by default + source toggle).
 * Adapted from cyber-wiki-front-old/src/screensets/demo/screens/richtext/components/MdRenderer.tsx.
 *
 * Right-click context menu (format / paragraph / clipboard) is provided
 * via shadcn-style ContextMenu. Top toolbar (DropdownMenu) is still TODO —
 * needs `dropdown-menu` shadcn primitive.
 */

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Editor,
  defaultValueCtx,
  rootCtx,
  editorViewCtx,
  parserCtx,
  schemaCtx,
} from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import {
  commonmark,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  insertHrCommand,
} from '@milkdown/kit/preset/commonmark';
import { gfm, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { trailing } from '@milkdown/kit/plugin/trailing';
import { indent } from '@milkdown/kit/plugin/indent';
import { callCommand } from '@milkdown/kit/utils';
import { DOMParser as PmDOMParser, DOMSerializer } from '@milkdown/kit/prose/model';
import {
  useEditor,
  useInstance,
  MilkdownProvider,
  Milkdown,
} from '@milkdown/react';
import {
  AtSign,
  Bold,
  Calendar,
  CheckSquare,
  ClipboardPaste,
  Code as CodeIcon,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Scissors,
  Strikethrough,
  Table as TableIcon,
  Tag,
  Type,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/app/components/primitives/ContextMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/primitives/DropdownMenu';

interface MdRendererProps {
  /** Initial content the editor mounts with (used once). */
  initialContent: string;
  /** Current draft content (controlled by parent). */
  content: string;
  /** Whether to render the raw-source textarea instead of WYSIWYG. */
  isSourceMode: boolean;
  onChange: (content: string) => void;
}

type EditorAction = (ctx: Ctx) => boolean;

/** Top toolbar for the WYSIWYG editor: format / headings / lists / insert. */
function MdToolbar() {
  const [loading, getEditor] = useInstance();

  const exec = (action: EditorAction) => {
    if (loading) return;
    try {
      const editor = getEditor();
      if (!editor) return;
      editor.action((ctx) => {
        ctx.get(editorViewCtx).focus();
        return true;
      });
      requestAnimationFrame(() => {
        try {
          getEditor()?.action(action);
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* editor not ready */
    }
  };

  /** Insert raw text at the current selection. Used for content blocks
   *  Milkdown doesn't expose a typed command for (links, mentions, etc.).
   *  The text appears verbatim in WYSIWYG; switching to Source and back
   *  re-parses it as proper markdown. */
  const insertText = (text: string) => {
    if (loading) return;
    try {
      const editor = getEditor();
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { from, to } = view.state.selection;
        view.dispatch(view.state.tr.insertText(text, from, to));
        view.focus();
        return true;
      });
    } catch {
      /* editor not ready */
    }
  };

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const insertCodeBlock = () => insertText('\n```\n\n```\n');
  const insertTable = () =>
    insertText('\n| Column 1 | Column 2 |\n|----------|----------|\n| value 1  | value 2  |\n');
  const insertLink = () => insertText('[link text](https://)');
  const insertImage = () => insertText('![alt text](https://)');
  const insertTask = () => insertText('- [ ] ');
  const insertDate = () => insertText(todayIso());
  const insertJiraBadge = () => insertText('[JIRA:KEY-123]');
  const insertMention = () => insertText('@username');

  type ToolbarButtonProps = {
    title: string;
    onClick: () => void;
    children: ReactNode;
  };
  const Btn = ({ title, onClick, children }: ToolbarButtonProps) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 border-b border-border bg-muted px-3 py-1">
      <Btn title="Bold (⌘B)" onClick={() => exec(callCommand(toggleStrongCommand.key))}>
        <Bold size={14} />
      </Btn>
      <Btn title="Italic (⌘I)" onClick={() => exec(callCommand(toggleEmphasisCommand.key))}>
        <Italic size={14} />
      </Btn>
      <Btn title="Strikethrough" onClick={() => exec(callCommand(toggleStrikethroughCommand.key))}>
        <Strikethrough size={14} />
      </Btn>
      <Btn title="Inline code (⌘E)" onClick={() => exec(callCommand(toggleInlineCodeCommand.key))}>
        <CodeIcon size={14} />
      </Btn>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            title="Headings"
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Type size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onSelect={() => exec(callCommand(wrapInHeadingCommand.key, 1))}>
            <Heading1 className="mr-2 h-4 w-4" /> Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exec(callCommand(wrapInHeadingCommand.key, 2))}>
            <Heading2 className="mr-2 h-4 w-4" /> Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exec(callCommand(wrapInHeadingCommand.key, 3))}>
            <Heading3 className="mr-2 h-4 w-4" /> Heading 3
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Btn title="Bullet list" onClick={() => exec(callCommand(wrapInBulletListCommand.key))}>
        <List size={14} />
      </Btn>
      <Btn title="Ordered list" onClick={() => exec(callCommand(wrapInOrderedListCommand.key))}>
        <ListOrdered size={14} />
      </Btn>
      <Btn title="Quote" onClick={() => exec(callCommand(wrapInBlockquoteCommand.key))}>
        <Quote size={14} />
      </Btn>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      {/* Insert dropdown: markdown-specific content blocks. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            title="Insert"
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Plus size={14} />
            <span className="text-xs">Insert</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onSelect={insertCodeBlock}>
            <CodeIcon className="mr-2 h-4 w-4" /> Code block
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={insertTable}>
            <TableIcon className="mr-2 h-4 w-4" /> Table
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={insertLink}>
            <LinkIcon className="mr-2 h-4 w-4" /> Link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={insertImage}>
            <ImageIcon className="mr-2 h-4 w-4" /> Image
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={insertTask}>
            <CheckSquare className="mr-2 h-4 w-4" /> Task list item
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={insertDate}>
            <Calendar className="mr-2 h-4 w-4" /> Today&apos;s date
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={insertMention}>
            <AtSign className="mr-2 h-4 w-4" /> Mention
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={insertJiraBadge}>
            <Tag className="mr-2 h-4 w-4" /> JIRA badge
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exec(callCommand(insertHrCommand.key))}>
            <Minus className="mr-2 h-4 w-4" /> Horizontal rule
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Right-click menu over the editor area: format / paragraph / clipboard. */
function MdRightClickMenu({ children }: { children: ReactNode }) {
  const [loading, getEditor] = useInstance();

  const focusEditor = useCallback(() => {
    if (loading) return;
    try {
      const editor = getEditor();
      if (!editor) return;
      editor.action((ctx) => {
        ctx.get(editorViewCtx).focus();
        return true;
      });
    } catch {
      // editor not ready
    }
  }, [loading, getEditor]);

  const exec = useCallback(
    (action: EditorAction) => {
      if (loading) return;
      focusEditor();
      requestAnimationFrame(() => {
        try {
          const editor = getEditor();
          if (!editor) return;
          editor.action(action);
        } catch {
          // editor not ready
        }
      });
    },
    [loading, getEditor, focusEditor],
  );

  const getSelectedText = useCallback((): string | null => {
    if (loading) return null;
    try {
      const editor = getEditor();
      if (!editor) return null;
      let text: string | null = null;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { from, to } = view.state.selection;
        if (from !== to) {
          text = view.state.doc.textBetween(from, to, '\n');
        }
        return true;
      });
      return text;
    } catch {
      return null;
    }
  }, [loading, getEditor]);

  const deleteSelection = useCallback(() => {
    try {
      const editor = getEditor();
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.deleteSelection());
        return true;
      });
    } catch {
      // editor not ready
    }
  }, [getEditor]);

  const handleCut = useCallback(() => {
    focusEditor();
    requestAnimationFrame(() => {
      const text = getSelectedText();
      if (!text) return;
      navigator.clipboard
        .writeText(text)
        .then(deleteSelection)
        .catch(() => {});
    });
  }, [focusEditor, getSelectedText, deleteSelection]);

  const handleCopy = useCallback(() => {
    focusEditor();
    requestAnimationFrame(() => {
      const text = getSelectedText();
      if (!text) return;
      navigator.clipboard.writeText(text).catch(() => {});
    });
  }, [focusEditor, getSelectedText]);

  const pasteIntoEditor = useCallback(
    (text: string) => {
      try {
        const editor = getEditor();
        if (!editor) return;
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const parser = ctx.get(parserCtx);
          const schema = ctx.get(schemaCtx);
          const doc = parser(text);
          if (!doc || typeof doc === 'string') return false;
          const domSerializer = DOMSerializer.fromSchema(schema);
          const fragment = domSerializer.serializeFragment(doc.content);
          const domParser = PmDOMParser.fromSchema(schema);
          const slice = domParser.parseSlice(fragment);
          view.dispatch(view.state.tr.replaceSelection(slice));
          return true;
        });
      } catch {
        // editor not ready
      }
    },
    [getEditor],
  );

  const handlePaste = useCallback(() => {
    if (loading) return;
    focusEditor();
    navigator.clipboard.readText().then((text) => {
      requestAnimationFrame(() => pasteIntoEditor(text));
    });
  }, [loading, focusEditor, pasteIntoEditor]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="block min-h-full">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Type className="mr-2 h-4 w-4" />
            Format
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onSelect={() => exec(callCommand(toggleStrongCommand.key))}>
              <Bold className="mr-2 h-4 w-4" />
              Bold
              <ContextMenuShortcut>⌘B</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => exec(callCommand(toggleEmphasisCommand.key))}>
              <Italic className="mr-2 h-4 w-4" />
              Italic
              <ContextMenuShortcut>⌘I</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => exec(callCommand(toggleStrikethroughCommand.key))}
            >
              <Strikethrough className="mr-2 h-4 w-4" />
              Strikethrough
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => exec(callCommand(toggleInlineCodeCommand.key))}>
              <CodeIcon className="mr-2 h-4 w-4" />
              Inline code
              <ContextMenuShortcut>⌘E</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Pilcrow className="mr-2 h-4 w-4" />
            Paragraph
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onSelect={() => exec(callCommand(wrapInHeadingCommand.key, 1))}>
              <Heading1 className="mr-2 h-4 w-4" /> Heading 1
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => exec(callCommand(wrapInHeadingCommand.key, 2))}>
              <Heading2 className="mr-2 h-4 w-4" /> Heading 2
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => exec(callCommand(wrapInHeadingCommand.key, 3))}>
              <Heading3 className="mr-2 h-4 w-4" /> Heading 3
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => exec(callCommand(wrapInBulletListCommand.key))}>
              <List className="mr-2 h-4 w-4" /> Bullet list
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => exec(callCommand(wrapInOrderedListCommand.key))}>
              <ListOrdered className="mr-2 h-4 w-4" /> Ordered list
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => exec(callCommand(wrapInBlockquoteCommand.key))}>
              <Quote className="mr-2 h-4 w-4" /> Quote
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Plus className="mr-2 h-4 w-4" />
            Insert
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onSelect={() => exec(callCommand(insertHrCommand.key))}>
              <Minus className="mr-2 h-4 w-4" /> Horizontal rule
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={handleCut}>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handlePaste}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Inner Milkdown-aware component. Must live inside <MilkdownProvider>. */
function MdLoaded({
  initialContent,
  content,
  isSourceMode,
  onChange,
}: MdRendererProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [, getInstance] = useInstance();
  const prevSourceModeRef = useRef(isSourceMode);
  const contentRef = useRef(content);
  contentRef.current = content;

  // When toggling out of source-mode back to WYSIWYG, reseed the editor doc
  // with the current draft text so external textarea edits apply.
  useEffect(() => {
    const wasSource = prevSourceModeRef.current;
    prevSourceModeRef.current = isSourceMode;
    if (!wasSource || isSourceMode) return;
    try {
      const editor = getInstance();
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const doc = parser(contentRef.current);
        if (doc && typeof doc !== 'string') {
          const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
          view.dispatch(tr);
        }
        return true;
      });
    } catch {
      // editor not ready
    }
  }, [isSourceMode, getInstance]);

  const editorInfo = useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContent);
        ctx.get(listenerCtx).markdownUpdated((_ctx, md) => {
          onChangeRef.current(md);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
      .use(clipboard)
      .use(trailing)
      .use(indent);
  }, []);

  const stats = useMemo(() => {
    const words = content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_`\-[\]()]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return {
      words,
      chars: content.length,
      lines: content.split('\n').length,
    };
  }, [content]);

  let body: ReactNode;
  if (editorInfo.loading) {
    body = (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading editor…
      </div>
    );
  } else if (isSourceMode) {
    body = (
      <div className="flex flex-1 flex-col overflow-auto">
        <div className="flex w-full flex-1 flex-col px-8 py-6">
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full resize-none bg-background font-mono text-sm leading-relaxed outline-none text-foreground"
          />
        </div>
      </div>
    );
  } else {
    body = null;
  }

  return (
    <>
      {/* Milkdown stays mounted so the editor can initialise; hidden via CSS
          while loading or in source mode. Full-width — outer FileViewer
          decides the column width. */}
      {!editorInfo.loading && !isSourceMode && <MdToolbar />}

      <div
        className={
          editorInfo.loading || isSourceMode ? 'hidden' : 'flex-1 overflow-auto'
        }
      >
        <MdRightClickMenu>
          <div className="px-8 py-6 prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-li:leading-relaxed focus-within:outline-none">
            <Milkdown />
          </div>
        </MdRightClickMenu>
      </div>

      {body}

      {!editorInfo.loading && (
        <div className="flex items-center justify-between border-t border-border px-4 py-1.5 text-xs text-muted-foreground bg-muted">
          <div className="flex items-center gap-3">
            <span>{stats.words} words</span>
            <span>{stats.chars} chars</span>
            <span>{stats.lines} lines</span>
          </div>
          <span className="text-[0.625rem] uppercase tracking-wider opacity-60">
            Milkdown
          </span>
        </div>
      )}
    </>
  );
}

export function MdRenderer(props: MdRendererProps) {
  return (
    <div className="relative flex h-full w-full flex-1 min-w-0 flex-col overflow-hidden">
      <MilkdownProvider>
        <MdLoaded {...props} />
      </MilkdownProvider>
    </div>
  );
}
