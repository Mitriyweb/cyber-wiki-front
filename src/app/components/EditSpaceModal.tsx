import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { eventBus } from '@cyberfabric/react';
import { SpaceVisibility, type Space, type UpdateSpaceRequest } from '@/app/api';
import { updateSpace } from '@/app/actions/wikiActions';

interface EditSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space;
}

export default function EditSpaceModal({ isOpen, onClose, space }: EditSpaceModalProps) {
  const getCurrentGitUrl = (s: Space) => {
    if (!s.git_base_url || !s.git_repository_id) return '';
    if (s.git_provider === 'bitbucket_server' && s.git_project_key) {
      return `${s.git_base_url}/projects/${s.git_project_key}/repos/${s.git_repository_id}/`;
    }
    return `${s.git_base_url}/${s.git_repository_id}`;
  };

  const [formData, setFormData] = useState({
    name: space.name,
    description: space.description || '',
    visibility: space.visibility,
    git_provider: space.git_provider || 'bitbucket_server',
    git_repository_url: getCurrentGitUrl(space),
    git_default_branch: space.git_default_branch || '',
    edit_fork_project_key: space.edit_fork_project_key || '',
    edit_fork_repo_slug: space.edit_fork_repo_slug || '',
    edit_fork_ssh_url: space.edit_fork_ssh_url || '',
    edit_fork_local_path: space.edit_fork_local_path || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      name: space.name,
      description: space.description || '',
      visibility: space.visibility,
      git_provider: space.git_provider || 'bitbucket_server',
      git_repository_url: getCurrentGitUrl(space),
      git_default_branch: space.git_default_branch || '',
      edit_fork_project_key: space.edit_fork_project_key || '',
      edit_fork_repo_slug: space.edit_fork_repo_slug || '',
      edit_fork_ssh_url: space.edit_fork_ssh_url || '',
      edit_fork_local_path: space.edit_fork_local_path || '',
    });
    setError(null);
  }, [space]);

  useEffect(() => {
    const subUpdated = eventBus.on('wiki/space/updated', () => {
      setLoading(false);
      onClose();
    });
    const subError = eventBus.on('wiki/space/error', ({ error: msg }) => {
      setLoading(false);
      setError(msg);
    });
    return () => {
      subUpdated.unsubscribe();
      subError.unsubscribe();
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data: UpdateSpaceRequest = {
      name: formData.name,
      description: formData.description,
      visibility: formData.visibility as SpaceVisibility,
      git_provider: formData.git_provider,
      git_repository_url: formData.git_repository_url || undefined,
      git_default_branch: formData.git_default_branch,
      edit_fork_project_key: formData.edit_fork_project_key || undefined,
      edit_fork_repo_slug: formData.edit_fork_repo_slug || undefined,
      edit_fork_ssh_url: formData.edit_fork_ssh_url || undefined,
      edit_fork_local_path: formData.edit_fork_local_path || undefined,
    };
    updateSpace(space.slug, data);
  };

  if (!isOpen) return null;

  const forkComplete =
    formData.edit_fork_project_key && formData.edit_fork_repo_slug && formData.edit_fork_ssh_url;
  const forkPartial =
    !forkComplete &&
    (formData.edit_fork_project_key || formData.edit_fork_repo_slug || formData.edit_fork_ssh_url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl bg-card border">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b bg-card">
          <h2 className="text-xl font-bold">Edit Space</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-all text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-lg text-sm border border-destructive bg-destructive/10 text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium mb-2">Space Key (Slug)</label>
              <input type="text" value={space.slug} disabled className="w-full px-3 py-2 rounded-lg border opacity-60 cursor-not-allowed bg-muted" />
              <p className="text-xs mt-1 text-muted-foreground">Slug cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Space Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border bg-background resize-none"
                placeholder="Technical documentation for the engineering team"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Visibility *</label>
              <select
                value={formData.visibility}
                onChange={e => setFormData({ ...formData, visibility: e.target.value as SpaceVisibility })}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              >
                <option value="private">Private - Only you and invited users</option>
                <option value="team">Team - All authenticated users</option>
                <option value="public">Public - Anyone with the link</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Git Repository</h3>

            <div>
              <label className="block text-sm font-medium mb-2">Git Provider *</label>
              <select
                value={formData.git_provider}
                onChange={e => setFormData({ ...formData, git_provider: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              >
                <option value="bitbucket_server">Bitbucket Server</option>
                <option value="github">GitHub</option>
                <option value="local_git">Local Git</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Repository URL</label>
              <input
                type="text"
                value={formData.git_repository_url}
                onChange={e => setFormData({ ...formData, git_repository_url: e.target.value })}
                placeholder="https://git.example.com/projects/PROJ/repos/my-repo/"
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Default Branch</label>
              <input
                type="text"
                value={formData.git_default_branch}
                onChange={e => setFormData({ ...formData, git_default_branch: e.target.value })}
                placeholder="Leave empty to use repository default"
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
              <p className="text-xs mt-1 text-muted-foreground">Leave empty to use the repository's default branch</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Edit Workflow (Optional)</h3>
              <p className="text-sm mt-1 text-muted-foreground">
                Configure a fork repository to enable in-browser editing and PR creation
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fork Project Key</label>
              <input
                type="text"
                value={formData.edit_fork_project_key}
                onChange={e => setFormData({ ...formData, edit_fork_project_key: e.target.value })}
                placeholder="e.g., ~username or PROJECT"
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fork Repository Slug</label>
              <input
                type="text"
                value={formData.edit_fork_repo_slug}
                onChange={e => setFormData({ ...formData, edit_fork_repo_slug: e.target.value })}
                placeholder="e.g., cyber-repo"
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fork SSH URL</label>
              <input
                type="text"
                value={formData.edit_fork_ssh_url}
                onChange={e => setFormData({ ...formData, edit_fork_ssh_url: e.target.value })}
                placeholder="ssh://git@git.example.com/~username/repo.git"
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Local Fork Path (Development)</label>
              <input
                type="text"
                value={formData.edit_fork_local_path}
                onChange={e => setFormData({ ...formData, edit_fork_local_path: e.target.value })}
                placeholder="/path/to/local/fork/repo"
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
              <p className="text-xs mt-1 text-muted-foreground">
                Local path to pre-cloned fork repo (for development, overrides SSH URL)
              </p>
            </div>

            {formData.edit_fork_local_path ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                <span>✓</span>
                <span>Edit workflow enabled (using local repo)</span>
              </div>
            ) : forkComplete ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                <span>✓</span>
                <span>Edit workflow will be enabled for this space</span>
              </div>
            ) : forkPartial ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                <span>⚠</span>
                <span>Fill all three fields to enable edit workflow</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {loading ? 'Updating...' : 'Update Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
