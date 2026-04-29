import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { eventBus } from '@cyberfabric/react';
import { kebabCase, last, startCase } from 'lodash';
import { loadSpaces, createSpace } from '@/app/actions/wikiActions';
import { SpaceVisibility, type CreateSpaceRequest, type Space } from '@/app/api';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM: CreateSpaceRequest = {
  slug: '',
  name: '',
  description: '',
  visibility: SpaceVisibility.Team,
  git_provider: 'bitbucket_server',
  git_repository_url: '',
  git_default_branch: '',
};

interface FieldErrors {
  git_repository_url?: string;
  name?: string;
  slug?: string;
  description?: string;
  git_default_branch?: string;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validate a Git repository URL. Accepts HTTPS / HTTP / SSH-style URLs. */
function validateRepoUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return 'Repository URL is required';
  // Permissive: HTTPS/HTTP, ssh://, or `user@host:path` (Git SSH shorthand).
  if (/^https?:\/\/\S+$/i.test(trimmed)) return undefined;
  if (/^ssh:\/\/\S+$/i.test(trimmed)) return undefined;
  if (/^[^@\s]+@[^:\s]+:\S+$/.test(trimmed)) return undefined;
  return 'Use a full HTTPS URL (https://…) or SSH form (git@host:org/repo.git)';
}

/**
 * Run all validations against the form state. Returns a map of field →
 * message; an empty map means the form can be submitted.
 */
function validate(form: CreateSpaceRequest, existingSlugs: Set<string>): FieldErrors {
  const errors: FieldErrors = {};

  const urlError = validateRepoUrl(form.git_repository_url ?? '');
  if (urlError) errors.git_repository_url = urlError;

  const name = form.name.trim();
  if (!name) {
    errors.name = 'Name is required';
  } else if (name.length > 100) {
    errors.name = 'Keep the name under 100 characters';
  }

  const slug = form.slug.trim();
  if (!slug) {
    errors.slug = 'Space key is required';
  } else if (slug.length < 2) {
    errors.slug = 'Space key must be at least 2 characters';
  } else if (slug.length > 60) {
    errors.slug = 'Keep the space key under 60 characters';
  } else if (!SLUG_RE.test(slug)) {
    errors.slug = 'Use lowercase letters, digits, and single hyphens only';
  } else if (existingSlugs.has(slug)) {
    errors.slug = 'A space with this key already exists';
  }

  const desc = (form.description ?? '').trim();
  if (desc.length > 500) {
    errors.description = 'Keep the description under 500 characters';
  }

  const branch = (form.git_default_branch ?? '').trim();
  if (branch && /\s/.test(branch)) {
    errors.git_default_branch = 'Branch name can\'t contain spaces';
  }

  return errors;
}

/**
 * Extract a sensible repo "leaf" from a Git URL — the last meaningful path
 * segment, with `.git` stripped. Works for HTTPS URLs (GitHub, Bitbucket
 * Server, GitLab) and SSH-style `git@host:org/repo.git`.
 *
 * Returns `''` when nothing useful can be derived (e.g. empty input or a URL
 * with no path).
 */
function deriveRepoLeaf(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  // Normalize SSH form so URL parsing works: `git@host:org/repo.git`
  // → `ssh://git@host/org/repo.git`.
  const sshNormalized = trimmed.replace(/^([^@\s]+@[^:\s]+):(?!\/\/)/, 'ssh://$1/');
  let pathname: string;
  try {
    pathname = new URL(sshNormalized).pathname;
  } catch {
    pathname = sshNormalized;
  }
  const segments = pathname.split('/').filter(Boolean);
  const leaf = last(segments) ?? '';
  return leaf.replace(/\.git$/i, '');
}

export default function CreateSpaceModal({ isOpen, onClose }: CreateSpaceModalProps) {
  const [formData, setFormData] = useState<CreateSpaceRequest>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True once the user has manually typed in slug/name — locks them against
   *  further auto-fill from the URL so user input is never clobbered. */
  const [slugTouched, setSlugTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  /** Per-field "did the user interact with this yet" flags. We only reveal a
   *  validation message once the field has been touched, otherwise the form
   *  shows a wall of errors before the user has even typed. */
  const [touched, setTouched] = useState<Record<keyof FieldErrors, boolean>>({
    git_repository_url: false,
    name: false,
    slug: false,
    description: false,
    git_default_branch: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  /** Slugs of spaces that already exist — used to enforce uniqueness on the
   *  client so the user gets immediate feedback instead of a backend 400. */
  const [existingSlugs, setExistingSlugs] = useState<Set<string>>(new Set());

  // Pull the current spaces list when the modal opens so we can warn about
  // duplicate slugs before the user submits.
  useEffect(() => {
    if (!isOpen) return undefined;
    const sub = eventBus.on('wiki/spaces/loaded', (payload: { all: Space[] }) => {
      setExistingSlugs(new Set(payload.all.map((s) => s.slug)));
    });
    loadSpaces();
    return () => sub.unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    const subCreated = eventBus.on('wiki/space/created', () => {
      setLoading(false);
      setFormData(EMPTY_FORM);
      setSlugTouched(false);
      setNameTouched(false);
      setTouched({
        git_repository_url: false,
        name: false,
        slug: false,
        description: false,
        git_default_branch: false,
      });
      setSubmitAttempted(false);
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

  const fieldErrors = useMemo(
    () => validate(formData, existingSlugs),
    [formData, existingSlugs],
  );
  const hasErrors = Object.keys(fieldErrors).length > 0;
  /** Show a field's error only after the user has touched it OR after the
   *  user has hit Submit (in which case we want to surface every blocker). */
  const showError = (field: keyof FieldErrors): string | undefined =>
    (touched[field] || submitAttempted) ? fieldErrors[field] : undefined;
  const markTouched = (field: keyof FieldErrors) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  // Auto-derive slug + name from the repo URL until the user types in
  // those fields explicitly. Empty URL clears the auto-filled values too.
  const repoLeaf = useMemo(
    () => deriveRepoLeaf(formData.git_repository_url ?? ''),
    [formData.git_repository_url],
  );
  const derivedSlug = useMemo(() => kebabCase(repoLeaf), [repoLeaf]);
  const derivedName = useMemo(() => startCase(repoLeaf), [repoLeaf]);

  useEffect(() => {
    setFormData((prev) => {
      const nextSlug = slugTouched ? prev.slug : derivedSlug;
      const nextName = nameTouched ? prev.name : derivedName;
      if (nextSlug === prev.slug && nextName === prev.name) return prev;
      return { ...prev, slug: nextSlug, name: nextName };
    });
  }, [derivedSlug, derivedName, slugTouched, nameTouched]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (hasErrors) return;
    setLoading(true);
    setError(null);
    createSpace({
      ...formData,
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      description: (formData.description ?? '').trim(),
      git_repository_url: (formData.git_repository_url ?? '').trim(),
      git_default_branch: (formData.git_default_branch ?? '').trim(),
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-lg shadow-xl bg-card border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Create New Space</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {error && (
            <div className="p-3 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Git Repository</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Repository URL *</label>
              <input
                type="text"
                required
                value={formData.git_repository_url}
                onChange={e => setFormData({ ...formData, git_repository_url: e.target.value })}
                onBlur={() => markTouched('git_repository_url')}
                placeholder="https://git.example.com/projects/PROJ/repos/my-repo/"
                className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 ${
                  showError('git_repository_url')
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-primary'
                }`}
                autoFocus
              />
              {showError('git_repository_url') ? (
                <p className="text-xs mt-1 text-destructive">{showError('git_repository_url')}</p>
              ) : (
                <p className="text-xs mt-1 text-muted-foreground">
                  Name and Space Key below auto-fill from the repo name. You can edit them.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Git Provider *</label>
                <select
                  value={formData.git_provider}
                  onChange={e => setFormData({ ...formData, git_provider: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="bitbucket_server">Bitbucket Server</option>
                  <option value="github">GitHub</option>
                  <option value="local_git">Local Git</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Default Branch</label>
                <input
                  type="text"
                  value={formData.git_default_branch}
                  onChange={e => setFormData({ ...formData, git_default_branch: e.target.value })}
                  onBlur={() => markTouched('git_default_branch')}
                  placeholder="repository default"
                  className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 ${
                    showError('git_default_branch')
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-primary'
                  }`}
                />
                {showError('git_default_branch') && (
                  <p className="text-xs mt-1 text-destructive">{showError('git_default_branch')}</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-2 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Basic Information</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Space Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => {
                    setNameTouched(true);
                    setFormData({ ...formData, name: e.target.value });
                  }}
                  onBlur={() => markTouched('name')}
                  placeholder="Engineering Wiki"
                  className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 ${
                    showError('name')
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-primary'
                  }`}
                />
                {showError('name') && (
                  <p className="text-xs mt-1 text-destructive">{showError('name')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Space Key (Slug) *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={e => {
                    setSlugTouched(true);
                    setFormData({
                      ...formData,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    });
                  }}
                  onBlur={() => markTouched('slug')}
                  placeholder="engineering-wiki"
                  className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 ${
                    showError('slug')
                      ? 'border-destructive focus:ring-destructive'
                      : 'border-border focus:ring-primary'
                  }`}
                />
                {showError('slug') && (
                  <p className="text-xs mt-1 text-destructive">{showError('slug')}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                onBlur={() => markTouched('description')}
                placeholder="Technical documentation for the engineering team"
                rows={2}
                className={`w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 ${
                  showError('description')
                    ? 'border-destructive focus:ring-destructive'
                    : 'border-border focus:ring-primary'
                }`}
              />
              {showError('description') && (
                <p className="text-xs mt-1 text-destructive">{showError('description')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Visibility *</label>
              <select
                value={formData.visibility}
                onChange={e =>
                  setFormData({ ...formData, visibility: e.target.value as SpaceVisibility })
                }
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="private">Private — Only you and invited users</option>
                <option value="team">Team — All authenticated users</option>
                <option value="public">Public — Anyone with the link</option>
              </select>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (submitAttempted && hasErrors)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
