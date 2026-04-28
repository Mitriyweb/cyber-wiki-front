import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { eventBus } from '@cyberfabric/react';
import { SpaceVisibility, type CreateSpaceRequest } from '@/app/api';
import { createSpace } from '@/app/actions/wikiActions';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateSpaceModal({ isOpen, onClose }: CreateSpaceModalProps) {
  const [formData, setFormData] = useState<CreateSpaceRequest>({
    slug: '',
    name: '',
    description: '',
    visibility: SpaceVisibility.Team,
    git_provider: 'bitbucket_server',
    git_repository_url: '',
    git_default_branch: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subCreated = eventBus.on('wiki/space/created', () => {
      setLoading(false);
      setFormData({
        slug: '',
        name: '',
        description: '',
        visibility: SpaceVisibility.Team,
        git_provider: 'bitbucket_server',
        git_repository_url: '',
        git_default_branch: '',
      });
      // Close modal after a short delay to let spaces/load complete
      setTimeout(() => onClose(), 100);
    });
    const subError = eventBus.on('wiki/space/error', ({ error: msg }) => {
      setLoading(false);
      setError(msg);
    });
    return () => {
      subCreated.unsubscribe();
      subError.unsubscribe();
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    createSpace(formData);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-lg shadow-xl bg-card">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-bold">Create New Space</h2>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-muted transition-all text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Space Key (Slug) *</label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={e =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                  })
                }
                placeholder="engineering-wiki"
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm"
              />
              <p className="text-xs mt-0.5 text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Space Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Engineering Wiki"
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Technical documentation for the engineering team"
                rows={2}
                className="w-full px-3 py-1.5 rounded-md border bg-background resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Visibility *</label>
              <select
                value={formData.visibility}
                onChange={e =>
                  setFormData({ ...formData, visibility: e.target.value as SpaceVisibility })
                }
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm"
              >
                <option value="private">Private - Only you and invited users</option>
                <option value="team">Team - All authenticated users</option>
                <option value="public">Public - Anyone with the link</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Git Repository</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Git Provider *</label>
              <select
                value={formData.git_provider}
                onChange={e => setFormData({ ...formData, git_provider: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm"
              >
                <option value="bitbucket_server">Bitbucket Server</option>
                <option value="github">GitHub</option>
                <option value="local_git">Local Git</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Repository URL</label>
              <input
                type="text"
                value={formData.git_repository_url}
                onChange={e => setFormData({ ...formData, git_repository_url: e.target.value })}
                placeholder="https://git.example.com/projects/PROJ/repos/my-repo/"
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Default Branch</label>
              <input
                type="text"
                value={formData.git_default_branch}
                onChange={e => setFormData({ ...formData, git_default_branch: e.target.value })}
                placeholder="Leave empty to use repository default"
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium bg-muted hover:bg-muted/80 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
