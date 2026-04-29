/**
 * ApiTokensSection — manage personal API tokens (list/create/delete) on the
 * Profile page. Created token is shown once with a copy button.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { eventBus } from '@cyberfabric/react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';
import {
  createApiToken,
  deleteApiToken,
  loadApiTokens,
} from '@/app/actions/apiTokensActions';
import type { ApiToken } from '@/app/api';

export function ApiTokensSection() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<ApiToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ApiToken | null>(null);

  useEffect(() => {
    const loadedSub = eventBus.on('profile/api-tokens/loaded', ({ tokens: list }) => {
      setTokens(list);
      setLoading(false);
    });
    const errorSub = eventBus.on('profile/api-tokens/error', ({ error: msg }) => {
      setError(msg);
      setLoading(false);
      setCreating(false);
    });
    const createdSub = eventBus.on('profile/api-token/created', ({ token }) => {
      setRevealedToken(token);
      setName('');
      setExpiresInDays('');
      setCreating(false);
    });

    loadApiTokens();

    return () => {
      loadedSub.unsubscribe();
      errorSub.unsubscribe();
      createdSub.unsubscribe();
    };
  }, []);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const days = expiresInDays.trim() ? Number(expiresInDays.trim()) : undefined;
    createApiToken({
      name: name.trim(),
      ...(days != null && Number.isFinite(days) ? { expires_in_days: days } : {}),
    });
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — silently ignore.
    }
  };

  return (
    <>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete API token?"
        message={
          pendingDelete
            ? `Token "${pendingDelete.name}" will be revoked immediately. Any clients using it will stop working.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (pendingDelete) deleteApiToken(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Personal API Tokens</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use these tokens for programmatic access (CLI, AI agents, scripts).
          </p>
        </div>

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        {/* Newly-created token reveal */}
        {revealedToken?.token && (
          <div className="p-3 rounded-lg border border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
              Token created — copy it now, it won&apos;t be shown again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono break-all bg-background border border-border rounded px-2 py-1 text-foreground">
                {revealedToken.token}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(revealedToken.token!)}
                className="p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Copy"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setRevealedToken(null)}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs text-muted-foreground mb-1">Token name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CI pipeline"
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={creating}
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-muted-foreground mb-1">Expires in (days)</label>
            <input
              type="number"
              min={1}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="never"
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={creating}
            />
          </div>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus size={14} />
            Create
          </button>
        </form>

        {/* Tokens list */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Created</th>
                <th className="text-left px-3 py-2 font-medium">Expires</th>
                <th className="text-left px-3 py-2 font-medium">Last used</th>
                <th className="w-12 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground text-xs">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && tokens.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground text-xs">
                    No API tokens yet
                  </td>
                </tr>
              )}
              {!loading &&
                tokens.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{t.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : 'never'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setPendingDelete(t)}
                        className="p-1 text-destructive hover:text-destructive/80 rounded"
                        title="Delete token"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
