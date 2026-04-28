/**
 * FileTree — generic recursive tree of files/folders.
 *
 * Pure presentational: receives the tree as a prop (data flow lives in
 * `wiki/tree/load|loaded` events / the FileMappingApiService.getTree call).
 * Selection + expand/collapse + click-to-open. File-mapping–aware display
 * (uses `display_name` from `TreeNode` when available).
 *
 * Inspired by doclab components/common/FileTree.tsx — config-mode features
 * live in SpaceTree / FileMapping* components instead.
 */

import { Fragment, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react';
import { TreeNodeType, type TreeNode } from '@/app/api';

interface FileTreeProps {
  tree: TreeNode[];
  selectedPath?: string | null;
  initiallyExpandedPaths?: string[];
  /** Render extra controls per row (e.g. visibility checkbox in config mode). */
  renderRowExtras?: (node: TreeNode) => ReactNode;
  onSelectFile?: (node: TreeNode) => void;
  onToggleFolder?: (node: TreeNode, isExpanded: boolean) => void;
}

// Static Tailwind classes for indent levels (purge-safe).
// Index = nesting level; deeper levels clamp to the last class.
const LEVEL_PADDING_CLASS = [
  'pl-2',
  'pl-5',
  'pl-8',
  'pl-11',
  'pl-14',
  'pl-[4.25rem]',
  'pl-20',
  'pl-[5.75rem]',
  'pl-24',
  'pl-[6.75rem]',
];

function compareNodes(a: TreeNode, b: TreeNode): number {
  // Folders first, then by sort_order if both have it, else by display_name/name.
  const aIsDir = a.type === TreeNodeType.Dir;
  const bIsDir = b.type === TreeNodeType.Dir;
  if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
  if (a.sort_order != null && b.sort_order != null && a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order;
  }
  const aName = a.display_name || a.name || a.path;
  const bName = b.display_name || b.name || b.path;
  return aName.localeCompare(bName);
}

interface FileTreeNodeProps {
  node: TreeNode;
  level: number;
  selectedPath?: string | null;
  expanded: Set<string>;
  toggle: (path: string, node: TreeNode) => void;
  renderRowExtras?: (node: TreeNode) => ReactNode;
  onSelectFile?: (node: TreeNode) => void;
}

function FileTreeNode({
  node,
  level,
  selectedPath,
  expanded,
  toggle,
  renderRowExtras,
  onSelectFile,
}: FileTreeNodeProps) {
  const isDir = node.type === TreeNodeType.Dir;
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;
  const label = node.display_name || node.name || node.path.split('/').pop() || node.path;
  const sortedChildren = node.children ? [...node.children].sort(compareNodes) : [];
  const indentClass = LEVEL_PADDING_CLASS[Math.min(level, LEVEL_PADDING_CLASS.length - 1)];

  return (
    <>
      <div
        className={`flex items-center gap-1 ${indentClass} pr-2 py-1 text-sm cursor-pointer hover:bg-accent/50 ${
          isSelected ? 'bg-accent text-accent-foreground' : ''
        }`}
        onClick={() => {
          if (isDir) toggle(node.path, node);
          else onSelectFile?.(node);
        }}
      >
        {isDir ? (
          <button
            type="button"
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.path, node);
            }}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {isDir ? (
          <Folder size={14} className="flex-shrink-0 text-blue-600" />
        ) : (
          <File size={14} className="flex-shrink-0 text-muted-foreground" />
        )}

        <span className="truncate text-foreground flex-1">{label}</span>

        {renderRowExtras?.(node)}
      </div>

      {isDir && isExpanded &&
        sortedChildren.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            level={level + 1}
            selectedPath={selectedPath}
            expanded={expanded}
            toggle={toggle}
            renderRowExtras={renderRowExtras}
            onSelectFile={onSelectFile}
          />
        ))}
    </>
  );
}

export function FileTree({
  tree,
  selectedPath,
  initiallyExpandedPaths,
  renderRowExtras,
  onSelectFile,
  onToggleFolder,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initiallyExpandedPaths ?? []),
  );

  const toggle = (path: string, node: TreeNode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        onToggleFolder?.(node, false);
      } else {
        next.add(path);
        onToggleFolder?.(node, true);
      }
      return next;
    });
  };

  if (tree.length === 0) {
    return (
      <div className="px-4 py-2 text-sm text-muted-foreground">No files</div>
    );
  }

  const sorted = [...tree].sort(compareNodes);

  return (
    <div className="overflow-y-auto">
      {sorted.map((node) => (
        <Fragment key={node.path}>
          <FileTreeNode
            node={node}
            level={0}
            selectedPath={selectedPath}
            expanded={expanded}
            toggle={toggle}
            renderRowExtras={renderRowExtras}
            onSelectFile={onSelectFile}
          />
        </Fragment>
      ))}
    </div>
  );
}
