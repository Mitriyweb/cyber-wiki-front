/**
 * FileMappingConfiguration — full editor that wires together
 * FileMappingConfigPanel + FileMappingPreview, plus space-level filters,
 * default display-name source, and refresh / sync actions.
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 *
 * Inspired by doclab components/spaces/file-mapping/FileMappingConfiguration.tsx.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventBus } from '@cyberfabric/react';
import { Plus, X } from 'lucide-react';
import { FileMappingConfigPanel } from '@/app/components/file-mapping/FileMappingConfigPanel';
import { FileMappingPreview } from '@/app/components/file-mapping/FileMappingPreview';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';
import {
  loadFileMappings,
  refreshFileMappings,
  syncFileMappings,
} from '@/app/actions/fileMappingActions';
import { loadFileTree, updateSpace } from '@/app/actions/wikiActions';
import {
  DisplayNameSource,
  ViewMode,
  type FileMapping,
  type Space,
  type TreeNode,
} from '@/app/api';

const SPACE_DEFAULT_OPTIONS: Array<{ value: DisplayNameSource; label: string }> = [
  { value: DisplayNameSource.FirstH1, label: 'H1' },
  { value: DisplayNameSource.FirstH2, label: 'H2' },
  { value: DisplayNameSource.TitleFrontmatter, label: 'Frontmatter' },
  { value: DisplayNameSource.Filename, label: 'Filename' },
];

interface FileMappingConfigurationProps {
  space: Space;
  onClose: () => void;
}

export function FileMappingConfiguration({ space, onClose }: FileMappingConfigurationProps) {
  const [mappings, setMappings] = useState<FileMapping[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [filters, setFilters] = useState<string[]>(space.filters || []);
  const [newFilter, setNewFilter] = useState('');
  const [defaultSource, setDefaultSource] = useState<DisplayNameSource>(
    (space.default_display_name_source as DisplayNameSource) || DisplayNameSource.FirstH1,
  );
  const [pendingSync, setPendingSync] = useState(false);

  // Subscribe to events + initial load
  useEffect(() => {
    const subs = [
      eventBus.on('wiki/file-mappings/loaded', (payload) => {
        if (payload.spaceSlug === space.slug) {
          setMappings(payload.mappings);
        }
      }),
      eventBus.on('wiki/tree/loaded', (payload) => {
        setTree(payload.tree ?? []);
      }),
    ];
    loadFileMappings(space.slug);
    loadFileTree(space.slug, ViewMode.Documents);
    return () => {
      subs.forEach((s) => s.unsubscribe());
    };
  }, [space.slug]);

  // Index mappings by path (without trailing slash)
  const mappingsByPath = useMemo(() => {
    const map = new Map<string, FileMapping>();
    for (const m of mappings) {
      map.set(m.file_path.replace(/\/$/, ''), m);
    }
    return map;
  }, [mappings]);

  const persistFilters = useCallback(
    (next: string[]) => {
      setFilters(next);
      updateSpace(space.slug, { filters: next } as never);
    },
    [space.slug],
  );

  const handleAddFilter = useCallback(() => {
    const value = newFilter.trim();
    if (!value || filters.includes(value)) return;
    persistFilters([...filters, value]);
    setNewFilter('');
  }, [filters, newFilter, persistFilters]);

  const handleRemoveFilter = useCallback(
    (filter: string) => {
      persistFilters(filters.filter((f) => f !== filter));
    },
    [filters, persistFilters],
  );

  const handleChangeDefault = useCallback(
    (next: DisplayNameSource) => {
      setDefaultSource(next);
      updateSpace(space.slug, { default_display_name_source: next } as never);
    },
    [space.slug],
  );

  return (
    <>
      <ConfirmDialog
        open={pendingSync}
        title="Sync file mappings"
        message="Sync will remove mappings for deleted files and recompute effective values. Continue?"
        confirmLabel="Sync"
        onConfirm={() => {
          syncFileMappings(space.slug);
          setPendingSync(false);
        }}
        onCancel={() => setPendingSync(false)}
      />

      <div className="bg-background rounded-lg shadow-lg max-w-7xl mx-auto h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">File Mapping Configuration</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshFileMappings(space.slug)}
              className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
              title="Re-extract display names from file contents"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setPendingSync(true)}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              title="Drop mappings for deleted files and recompute effective values"
            >
              Sync
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-accent rounded text-muted-foreground"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Space-wide settings */}
        <div className="p-4 border-b border-border bg-muted space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Space default:</span>
            <select
              value={defaultSource}
              onChange={(e) => handleChangeDefault(e.target.value as DisplayNameSource)}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
            >
              {SPACE_DEFAULT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              (applies to all files unless overridden)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">Filters:</span>
            {filters.map((filter) => (
              <span
                key={filter}
                className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300 rounded text-sm flex items-center gap-1"
              >
                {filter}
                <button
                  type="button"
                  onClick={() => handleRemoveFilter(filter)}
                  className="hover:opacity-80"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={newFilter}
              onChange={(e) => setNewFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFilter();
                }
              }}
              placeholder=".xml"
              className="px-2 py-1 border border-border rounded text-sm w-20 bg-background text-foreground"
            />
            <button
              type="button"
              onClick={handleAddFilter}
              className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Two-pane editor */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 border-r border-border overflow-auto">
            <FileMappingConfigPanel
              spaceSlug={space.slug}
              tree={tree}
              mappings={mappingsByPath}
            />
          </div>
          <div className="w-96 overflow-auto">
            <FileMappingPreview documentTree={tree} />
          </div>
        </div>
      </div>
    </>
  );
}
