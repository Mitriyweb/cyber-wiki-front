/**
 * FileMappingConfigPanel — per-file editor for visibility and display-name
 * source. Renders the space's tree and overlays controls per row.
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 *
 * Mutates state via fileMappingActions; mappings come in as a prop so the
 * parent owns the data lifecycle.
 *
 * NOTE: full inheritance resolver and children-source / custom-name editor
 * from doclab are deferred — they belong to a more advanced editor view.
 */

import { useCallback } from 'react';
import { FileTree } from '@/app/components/file/FileTree';
import {
  createFileMapping,
  updateFileMapping,
  deleteFileMapping,
} from '@/app/actions/fileMappingActions';
import {
  DisplayNameSource,
  TreeNodeType,
  type FileMapping,
  type TreeNode,
} from '@/app/api';

const FILE_SOURCE_OPTIONS: Array<{ value: DisplayNameSource | ''; label: string }> = [
  { value: '', label: 'Inherit' },
  { value: DisplayNameSource.FirstH1, label: 'H1' },
  { value: DisplayNameSource.FirstH2, label: 'H2' },
  { value: DisplayNameSource.TitleFrontmatter, label: 'Frontmatter' },
  { value: DisplayNameSource.Filename, label: 'Filename' },
  { value: DisplayNameSource.Custom, label: 'Custom' },
];

interface FileMappingConfigPanelProps {
  spaceSlug: string;
  tree: TreeNode[];
  /** Mappings indexed by `file_path` (no trailing slash). */
  mappings: Map<string, FileMapping>;
}

export function FileMappingConfigPanel({
  spaceSlug,
  tree,
  mappings,
}: FileMappingConfigPanelProps) {
  const isFolderPath = (node: TreeNode) => node.type === TreeNodeType.Dir;

  const handleToggleVisibility = useCallback(
    (node: TreeNode, currentVisible: boolean) => {
      const mapping = mappings.get(node.path);
      const isFolder = isFolderPath(node);
      if (mapping) {
        updateFileMapping(spaceSlug, mapping.id, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: !currentVisible,
          display_name_source: mapping.display_name_source,
        });
      } else {
        createFileMapping(spaceSlug, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: !currentVisible,
          display_name_source: DisplayNameSource.FirstH1,
        });
      }
    },
    [mappings, spaceSlug],
  );

  const handleChangeSource = useCallback(
    (node: TreeNode, source: DisplayNameSource | '') => {
      const mapping = mappings.get(node.path);
      const isFolder = isFolderPath(node);

      if (!source) {
        // Empty = inherit; drop explicit mapping
        if (mapping) {
          deleteFileMapping(spaceSlug, mapping.id);
        }
        return;
      }

      if (mapping) {
        updateFileMapping(spaceSlug, mapping.id, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: mapping.is_visible,
          display_name_source: source,
        });
      } else {
        createFileMapping(spaceSlug, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: true,
          display_name_source: source,
        });
      }
    },
    [mappings, spaceSlug],
  );

  const renderRowExtras = useCallback(
    (node: TreeNode) => {
      const mapping = mappings.get(node.path);
      const isVisible = mapping?.is_visible ?? true;
      const currentSource = mapping?.display_name_source ?? '';
      const isFolder = isFolderPath(node);

      return (
        <div className="flex items-center gap-2 ml-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleVisibility(node, isVisible);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            Visible
          </label>
          {!isFolder && (
            <select
              value={currentSource}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleChangeSource(node, e.target.value as DisplayNameSource | '')}
              className="px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground"
            >
              {FILE_SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value || 'inherit'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          {mapping?.is_override && (
            <span className="text-xs text-blue-600 font-medium">override</span>
          )}
        </div>
      );
    },
    [handleChangeSource, handleToggleVisibility, mappings],
  );

  return <FileTree tree={tree} renderRowExtras={renderRowExtras} />;
}
