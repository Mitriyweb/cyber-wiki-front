/**
 * SpaceConfigurationPage
 *
 * Admin view for managing spaces — CRUD table with edit/delete,
 * favorites toggle, file mapping configuration.
 * Ported from doclab SpaceConfiguration view.
 */

import React, { useState, useEffect } from 'react';
import { eventBus } from '@cyberfabric/react';
import { Edit2, Trash2, Plus, Search, Star, Folders, CheckCircle2, AlertTriangle } from 'lucide-react';
import { loadSpaces, toggleFavorite, deleteSpace } from '@/app/actions/wikiActions';
import { type Space, type UserSpacePreference } from '@/app/api';
import CreateSpaceModal from '@/app/components/space/CreateSpaceModal';
import EditSpaceModal from '@/app/components/space/EditSpaceModal';
import { FileMappingConfiguration } from '@/app/components/file-mapping/FileMappingConfiguration';
import { PageTitle } from '@/app/layout';

interface SpaceConfigurationPageProps {
  navigate: (view: string) => void;
}

const SpaceConfigurationPage: React.FC<SpaceConfigurationPageProps> = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [favorites, setFavorites] = useState<UserSpacePreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [mappingSpace, setMappingSpace] = useState<Space | null>(null);

  useEffect(() => {
    const sub = eventBus.on('wiki/spaces/loaded', (payload) => {
      setSpaces(payload.all);
      setFavorites(payload.favorites);
      setLoading(false);
    });
    loadSpaces();
    return () => { sub.unsubscribe(); };
  }, []);

  const handleToggleFavorite = (space: Space) => {
    const isFavorite = favorites.some(f => f.space_slug === space.slug);
    toggleFavorite(space.slug, isFavorite);
  };

  const handleDeleteSpace = (slug: string) => {
    if (!window.confirm('Are you sure you want to delete this space? This action cannot be undone.')) {
      return;
    }
    deleteSpace(slug);
  };

  const filteredSpaces = spaces.filter(
    space =>
      space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      space.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (space.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'private': return 'Private';
      case 'team': return 'Team';
      case 'public': return 'Public';
      default: return visibility;
    }
  };

  const getProviderLabel = (provider: string | null) => {
    if (!provider) return 'Not configured';
    switch (provider) {
      case 'github': return 'GitHub';
      case 'bitbucket_server': return 'Bitbucket Server';
      case 'local_git': return 'Local Git';
      default: return provider;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-muted-foreground">Loading spaces...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <PageTitle title="Space Configuration" subtitle="Manage all spaces and their Git repository connections" />
      {/* Toolbar */}
      <div className="border-b border-border px-6 py-3">
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all"
          >
            <Plus size={20} />
            Create Space
          </button>
        </div>

        <div className="mt-3 relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search spaces..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filteredSpaces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              {searchQuery ? 'No spaces found matching your search' : 'No spaces configured yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground"
              >
                <Plus size={16} className="inline mr-2" />
                Create Your First Space
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Space</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Slug</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Visibility</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Git Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Repository</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Edit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpaces.map((space, index) => (
                  <tr
                    key={space.id}
                    className={`border-t border-border ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-foreground">{space.name}</div>
                        {space.description && (
                          <div className="text-sm mt-0.5 text-muted-foreground truncate max-w-xs">{space.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm px-2 py-1 rounded bg-muted text-foreground">{space.slug}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm px-2 py-1 rounded bg-muted text-foreground">
                        {getVisibilityLabel(space.visibility)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {getProviderLabel(space.git_provider)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {space.git_repository_name || space.git_repository_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {space.git_default_branch || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {space.edit_enabled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400" title="Edit fork configured — editing is available">
                          <CheckCircle2 size={14} />
                          Ready
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingSpace(space)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                          title="Edit fork not configured — click to set up"
                        >
                          <AlertTriangle size={14} />
                          Setup needed
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleFavorite(space)}
                          className="p-2 rounded-lg hover:bg-muted transition-all"
                          title={favorites.some(f => f.space_slug === space.slug) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            size={16}
                            className={favorites.some(f => f.space_slug === space.slug) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}
                          />
                        </button>
                        <button
                          onClick={() => setMappingSpace(space)}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition-all"
                          title="Configure file mapping (display names, filters, visibility)"
                        >
                          <Folders size={16} />
                        </button>
                        <button
                          onClick={() => setEditingSpace(space)}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition-all"
                          title="Edit space"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSpace(space.slug)}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-all"
                          title="Delete space"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateSpaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {editingSpace && (
        <EditSpaceModal
          isOpen={true}
          onClose={() => setEditingSpace(null)}
          space={editingSpace}
        />
      )}

      {mappingSpace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-7xl max-h-[90vh] overflow-hidden">
            <FileMappingConfiguration
              space={mappingSpace}
              onClose={() => setMappingSpace(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceConfigurationPage;
