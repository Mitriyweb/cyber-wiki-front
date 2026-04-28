/**
 * ProfilePage
 *
 * User profile with:
 * - User information
 * - Service token management (GitHub, Bitbucket, JIRA, Custom)
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { eventBus, useAppSelector, apiRegistry, type HeaderUser } from '@cyberfabric/react';
import { AccountsApiService, type MeResponse } from '@/app/api';
import {
  Edit, Check, X, Trash2, Clock, Settings,
  AlertCircle, CheckCircle2, User, ShieldCheck, Loader2,
} from 'lucide-react';
import { ServiceType } from '@/app/api/wikiTypes';
import type { ServiceToken, ServiceTokenCreate, TokenValidationResult, CacheSettings } from '@/app/api/wikiTypes';
import { loadServiceTokens, saveServiceToken, deleteServiceToken, validateServiceToken, loadCacheSettings, updateCacheSettings } from '@/app/actions/profileActions';
import { ApiTokensSection } from '@/app/components/ApiTokensSection';

// ─── Constants ──────────────────────────────────────────────────────────────

const SERVICE_ROWS: { serviceType: ServiceType; label: string; defaultBaseUrl: string }[] = [
  { serviceType: ServiceType.GitHub, label: 'GitHub', defaultBaseUrl: 'https://api.github.com' },
  { serviceType: ServiceType.BitbucketServer, label: 'Bitbucket Server', defaultBaseUrl: 'https://git.example.com' },
  { serviceType: ServiceType.Jira, label: 'JIRA', defaultBaseUrl: 'https://jira.example.com' },
  { serviceType: ServiceType.CustomHeader, label: 'Custom Token', defaultBaseUrl: '' },
];

// ─── ProfilePage ────────────────────────────────────────────────────────────

interface ProfilePageProps {
  navigate?: (view: string) => void;
}

function ProfilePage({ navigate: _navigate }: ProfilePageProps) {
  const headerState = useAppSelector((state) => state['layout/header'] as { user?: HeaderUser } | undefined);
  const headerUser = headerState?.user ?? null;

  // ── Full user info from /me ──
  const [userInfo, setUserInfo] = useState<MeResponse | null>(null);

  // ── Service Tokens state ──
  const [tokens, setTokens] = useState<ServiceToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [editForm, setEditForm] = useState({ baseUrl: '', username: '', token: '', name: '' });

  // ── Validation state ──
  const [validationResults, setValidationResults] = useState<Record<string, TokenValidationResult>>({});
  const [validatingIds, setValidatingIds] = useState<Set<string>>(new Set());

  // ── Cache settings state ──
  const [cacheSettings, setCacheSettings] = useState<CacheSettings | null>(null);

  // ── Messages ──
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Service Tokens effects ──
  useEffect(() => {
    const subLoaded = eventBus.on('profile/tokens/loaded', ({ tokens: t }) => {
      setTokens(t);
      setTokensLoading(false);
    });
    const subSaved = eventBus.on('profile/tokens/saved', ({ token }) => {
      setEditingService(null);
      setEditForm({ baseUrl: '', username: '', token: '', name: '' });
      setSuccess('Token configured successfully');
      setTimeout(() => setSuccess(null), 3000);
      setValidatingIds((prev) => new Set(prev).add(token.id));
    });
    const subDeleted = eventBus.on('profile/tokens/deleted', () => {
      setSuccess('Token deleted');
      setTimeout(() => setSuccess(null), 3000);
    });
    const subError = eventBus.on('profile/tokens/error', ({ error: e }) => {
      setError(e);
      setTokensLoading(false);
    });
    const subValidated = eventBus.on('profile/tokens/validated', ({ id, result }) => {
      setValidationResults((prev) => ({ ...prev, [id]: result }));
      setValidatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });

    const subCacheLoaded = eventBus.on('profile/cache/loaded', ({ settings }) => {
      setCacheSettings(settings);
    });
    const subCacheUpdated = eventBus.on('profile/cache/updated', ({ settings }) => {
      setCacheSettings(settings);
      setSuccess('Settings updated');
      setTimeout(() => setSuccess(null), 3000);
    });

    loadServiceTokens();
    loadCacheSettings();

    apiRegistry.getService(AccountsApiService).me.fetch().then((me) => {
      if (me) setUserInfo(me);
    }).catch(() => { /* ignore */ });

    return () => {
      subLoaded.unsubscribe();
      subSaved.unsubscribe();
      subDeleted.unsubscribe();
      subError.unsubscribe();
      subValidated.unsubscribe();
      subCacheLoaded.unsubscribe();
      subCacheUpdated.unsubscribe();
    };
  }, []);

  // ── Token handlers ──
  const findToken = useCallback(
    (serviceType: ServiceType) => tokens.find((t) => t.service_type === serviceType),
    [tokens],
  );

  const handleTokenEdit = useCallback((serviceType: ServiceType) => {
    const existing = tokens.find((t) => t.service_type === serviceType);
    setEditingService(serviceType);
    setEditForm({
      baseUrl: existing?.base_url || '',
      username: existing?.username || '',
      token: '',
      name: existing?.name || '',
    });
    setError(null);
    setSuccess(null);
  }, [tokens]);

  const handleTokenSave = useCallback((serviceType: ServiceType, e: FormEvent) => {
    e.preventDefault();
    const data: ServiceTokenCreate = { service_type: serviceType };

    if (serviceType === ServiceType.CustomHeader) {
      data.header_name = editForm.baseUrl || 'X-Custom-Token';
      data.name = editForm.name || 'Custom Token';
    } else {
      if (editForm.baseUrl) data.base_url = editForm.baseUrl;
      if (editForm.username) data.username = editForm.username;
    }
    if (editForm.token) data.token = editForm.token;

    saveServiceToken(data);
  }, [editForm]);

  const handleTokenDelete = useCallback((id: string, label: string) => {
    if (window.confirm(`Delete ${label} token?`)) {
      deleteServiceToken(id);
    }
  }, []);

  const handleTokenCancel = useCallback(() => {
    setEditingService(null);
    setEditForm({ baseUrl: '', username: '', token: '', name: '' });
    setError(null);
  }, []);

  const handleTokenValidate = useCallback((id: string) => {
    setValidatingIds((prev) => new Set(prev).add(id));
    setValidationResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    validateServiceToken(id);
  }, []);

  const isLoading = tokensLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>

        {/* Messages */}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* ═══ User Info ═══ */}
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-3 mb-4">
            <User size={20} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">User Information</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Username:</span>
              <span className="ml-2 font-medium text-foreground">{userInfo?.username || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              <span className="ml-2 text-foreground">{userInfo?.email || headerUser?.email || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Display Name:</span>
              <span className="ml-2 text-foreground">{headerUser?.displayName || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Role:</span>
              <span className="ml-2 text-foreground capitalize">{userInfo?.role || '—'}</span>
            </div>
          </div>
        </div>

        {/* ═══ Service Tokens ═══ */}
        <div className="border border-border rounded-lg bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Service Tokens</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure API tokens for Git providers and external services.
              Tokens are encrypted and never displayed after saving.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[28%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base URL</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Token</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SERVICE_ROWS.map(({ serviceType, label, defaultBaseUrl }) => {
                  const existing = findToken(serviceType);
                  const isEditing = editingService === serviceType;
                  const isConfigured = existing?.has_token ?? false;

                  return (
                    <tr key={serviceType} className="hover:bg-accent/30 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-foreground">{label}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground truncate" title={serviceType === ServiceType.CustomHeader ? (existing?.header_name || '') : (existing?.base_url || '')}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.baseUrl}
                            onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
                            placeholder={serviceType === ServiceType.CustomHeader ? 'X-Custom-Token' : defaultBaseUrl}
                            className="w-full px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          serviceType === ServiceType.CustomHeader
                            ? (existing?.header_name || 'Not configured')
                            : (existing?.base_url || 'Not configured')
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground truncate">
                        {isEditing && serviceType !== ServiceType.CustomHeader ? (
                          <input
                            type="text"
                            value={editForm.username}
                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                            placeholder={serviceType === ServiceType.Jira ? 'your.email@example.com' : 'Username'}
                            className="w-full px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          existing?.username || (serviceType === ServiceType.CustomHeader ? '—' : 'Not configured')
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-muted-foreground">
                        {isEditing ? (
                          <input
                            type="password"
                            value={editForm.token}
                            onChange={(e) => setEditForm({ ...editForm, token: e.target.value })}
                            placeholder="Enter token"
                            className="w-full px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          isConfigured ? '••••••••••' : 'Not configured'
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {(() => {
                          const vr = existing ? validationResults[existing.id] : undefined;
                          const isValidating = existing ? validatingIds.has(existing.id) : false;

                          if (isValidating) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 size={12} className="animate-spin" />
                                Checking…
                              </span>
                            );
                          }

                          const valid = vr?.valid ?? existing?.last_validation_valid ?? null;
                          const message = vr?.message ?? existing?.last_validation_message ?? null;
                          const checkedAt = existing?.last_validated_at;

                          if (valid !== null && message) {
                            return (
                              <div className="flex flex-col gap-0.5">
                                {valid ? (
                                  <span className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-400" title={message}>
                                    <CheckCircle2 size={12} className="shrink-0" />
                                    <span className="truncate">{message}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive" title={message}>
                                    <AlertCircle size={12} className="shrink-0" />
                                    <span className="truncate">{message}</span>
                                  </span>
                                )}
                                {checkedAt && !vr && (
                                  <span className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground pl-2">
                                    <Clock size={10} />
                                    {new Date(checkedAt).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          if (isConfigured) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-400">
                                <Check size={12} />
                                Configured
                              </span>
                            );
                          }
                          return <span className="text-muted-foreground text-xs">Not configured</span>;
                        })()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right text-sm">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => handleTokenSave(serviceType, e)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
                            >
                              <Check size={14} />
                              Save
                            </button>
                            <button
                              onClick={handleTokenCancel}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
                            >
                              <X size={14} />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {isConfigured && existing && (
                              <button
                                onClick={() => handleTokenValidate(existing.id)}
                                disabled={validatingIds.has(existing.id)}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                                title="Verify token"
                              >
                                {validatingIds.has(existing.id) ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <ShieldCheck size={14} />
                                )}
                                Verify
                              </button>
                            )}
                            <button
                              onClick={() => handleTokenEdit(serviceType)}
                              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-xs"
                            >
                              <Edit size={14} />
                              {isConfigured ? 'Edit' : 'Configure'}
                            </button>
                            {isConfigured && existing && (
                              <button
                                onClick={() => handleTokenDelete(existing.id, label)}
                                className="p-1 text-destructive hover:text-destructive/80 rounded"
                                title="Delete token"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Important Notes:</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>All tokens are encrypted before storage and never displayed after saving</li>
            <li>GitHub token requires <code className="bg-muted px-1 rounded text-xs">repo</code> scope for private repositories</li>
            <li>Bitbucket Server requires a Personal Access Token with repository read permissions</li>
          </ul>
        </div>

        {/* Personal API tokens */}
        <ApiTokensSection />

        {/* ═══ Settings ═══ */}
        <div className="border border-border rounded-lg bg-card">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Settings size={20} className="text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Settings</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Configure API response caching for faster development. Cached responses are stored in the database and reused for subsequent requests.
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Cache API responses</p>
                <p className="text-xs text-muted-foreground mt-0.5">Store API responses for faster development</p>
              </div>
              <button
                onClick={() => {
                  if (cacheSettings) {
                    updateCacheSettings({ cache_enabled: !cacheSettings.cache_enabled });
                  }
                }}
                disabled={!cacheSettings}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                  cacheSettings?.cache_enabled ? 'bg-primary' : 'bg-input'
                }`}
                role="switch"
                aria-checked={cacheSettings?.cache_enabled ?? false}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                    cacheSettings?.cache_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default ProfilePage;
