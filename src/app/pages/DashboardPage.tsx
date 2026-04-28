/**
 * DashboardPage
 *
 * Main landing page showing favorite and recent spaces.
 * Ported from doclab Dashboard view, adapted to FrontX event-driven architecture.
 */

import React, { useState, useEffect } from 'react';
import { eventBus } from '@cyberfabric/react';
import { Star, Clock, Plus, ArrowRight, Database, FileText, GitBranch } from 'lucide-react';
import { loadSpaces, toggleFavorite } from '@/app/actions/wikiActions';
import { Urls, type Space, type UserSpacePreference } from '@/app/api';
import CreateSpaceModal from '@/app/components/CreateSpaceModal';

interface DashboardPageProps {
  navigate: (view: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ navigate }) => {
  const [favorites, setFavorites] = useState<UserSpacePreference[]>([]);
  const [recent, setRecent] = useState<UserSpacePreference[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const sub = eventBus.on('wiki/spaces/loaded', (payload) => {
      setFavorites(payload.favorites);
      setRecent(payload.recent);
      setAllSpaces(payload.all);
      setLoading(false);
    });
    loadSpaces();
    return () => { sub.unsubscribe(); };
  }, []);

  const handleNavigateToSpace = (spaceSlug: string) => {
    navigate(`${Urls.Spaces}?space=${spaceSlug}`);
  };

  const handleToggleFavorite = (spaceSlug: string) => {
    const isFavorite = favorites.some(f => f.space_slug === spaceSlug);
    toggleFavorite(spaceSlug, isFavorite);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const favoriteSpaces = favorites
    .map((f) => allSpaces.find((s) => s.slug === f.space_slug))
    .filter(Boolean) as Space[];

  const recentSpaces = recent
    .filter((r) => !favorites.some((f) => f.space_slug === r.space_slug))
    .map((r) => allSpaces.find((s) => s.slug === r.space_slug))
    .filter(Boolean)
    .slice(0, 6) as Space[];

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm mt-1 text-muted-foreground">
              Welcome back! Here are your spaces.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus size={20} />
            Create Space
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Spaces Overview */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
              <Database size={20} className="text-primary" />
              Spaces Overview
            </h2>
            <span className="text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
              {allSpaces.length} {allSpaces.length === 1 ? 'space' : 'spaces'}
            </span>
          </div>

          {allSpaces.length === 0 ? (
            <div className="border border-border rounded-lg bg-card p-6 text-center text-muted-foreground text-sm">
              No spaces created yet.
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Pages</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Provider</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Branch</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Visibility</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Last Synced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allSpaces.map((space) => (
                    <tr
                      key={space.id}
                      className="hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => handleNavigateToSpace(space.slug)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {space.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-foreground truncate">{space.name}</div>
                            {space.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-xs">{space.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-sm text-foreground">
                          <FileText size={14} className="text-muted-foreground" />
                          {space.page_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {space.git_provider ? (
                          <span className="inline-flex items-center gap-1 text-sm text-foreground capitalize">
                            <GitBranch size={14} className="text-muted-foreground" />
                            {space.git_provider.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {space.git_default_branch || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                          {space.visibility}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {space.last_synced_at
                          ? new Date(space.last_synced_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Favorite Spaces */}
        {favoriteSpaces.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
                <Star size={20} className="text-yellow-500" />
                Favorite Spaces
              </h2>
              {favoriteSpaces.length > 6 && (
                <button
                  onClick={() => navigate(Urls.Spaces)}
                  className="text-sm flex items-center gap-1 text-primary"
                >
                  View all <ArrowRight size={16} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteSpaces.slice(0, 6).map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  isFavorite={true}
                  onNavigate={() => handleNavigateToSpace(space.slug)}
                  onToggleFavorite={() => handleToggleFavorite(space.slug)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recent Spaces */}
        {recentSpaces.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4 text-foreground">
              <Clock size={20} className="text-muted-foreground" />
              Recent Spaces
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentSpaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  isFavorite={false}
                  onNavigate={() => handleNavigateToSpace(space.slug)}
                  onToggleFavorite={() => handleToggleFavorite(space.slug)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {favoriteSpaces.length === 0 && recentSpaces.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-muted mb-4">
              <Star size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">No spaces yet</h3>
            <p className="mb-4 text-muted-foreground">Create your first space to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 rounded-lg font-medium bg-primary text-primary-foreground"
            >
              Create Space
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate(Urls.Spaces)}
              className="p-4 rounded-lg border border-border bg-card text-left transition-all hover:border-primary"
            >
              <div className="font-medium mb-1 text-foreground">Browse All Spaces</div>
              <div className="text-sm text-muted-foreground">View and search all available spaces</div>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-4 rounded-lg border border-border bg-card text-left transition-all hover:border-primary"
            >
              <div className="font-medium mb-1 text-foreground">Create New Space</div>
              <div className="text-sm text-muted-foreground">Set up a new documentation space</div>
            </button>
            <button
              onClick={() => navigate(Urls.SpaceConfiguration)}
              className="p-4 rounded-lg border border-border bg-card text-left transition-all hover:border-primary"
            >
              <div className="font-medium mb-1 text-foreground">Configuration</div>
              <div className="text-sm text-muted-foreground">Manage settings and preferences</div>
            </button>
          </div>
        </section>
      </div>

      <CreateSpaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
};

interface SpaceCardProps {
  space: Space;
  isFavorite: boolean;
  onNavigate: () => void;
  onToggleFavorite: () => void;
}

function SpaceCard({ space, isFavorite, onNavigate, onToggleFavorite }: SpaceCardProps) {
  return (
    <div
      className="group relative p-4 rounded-lg border border-border bg-card transition-all cursor-pointer hover:border-primary hover:-translate-y-0.5"
      onClick={onNavigate}
    >
      <button
        onClick={e => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          size={16}
          className={isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}
        />
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg flex-shrink-0">
          {space.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate text-foreground">{space.name}</h3>
          <p className="text-sm truncate text-muted-foreground">{space.page_count} pages</p>
        </div>
      </div>

      {space.description && (
        <p className="text-sm line-clamp-2 mb-3 text-muted-foreground">{space.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {space.git_provider && (
          <span className="capitalize">{space.git_provider.replace('_', ' ')}</span>
        )}
        {space.last_synced_at && (
          <span>Synced {new Date(space.last_synced_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
