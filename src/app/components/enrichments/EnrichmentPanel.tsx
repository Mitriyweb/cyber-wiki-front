/**
 * EnrichmentPanel — sidebar panel that aggregates all enrichments for a file.
 *
 * Tabs: Comments / Diffs / PRs / Local / Changes. Drives data via actions
 * (`loadEnrichments`, `loadComments`) and listens to `wiki/enrichments/loaded`
 * + `wiki/comments/loaded`. CommentsTab and ChangesTab are pulled in as
 * full-featured components; the remaining tabs are simple list-renders for
 * read-only payloads.
 */

import React, { useEffect, useState } from 'react';
import { eventBus } from '@cyberfabric/react';
import {
  AlertCircle,
  Check,
  Clock,
  Edit3,
  FileEdit,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  User,
} from 'lucide-react';
import { CommentsTab } from './CommentsTab';
import { ChangesTab } from './ChangesTab';
import { loadComments, loadEnrichments } from '@/app/actions/enrichmentActions';
import {
  EnrichmentTab,
  type CommentData,
  type DiffEnrichment,
  type EnrichmentsResponse,
  type LocalChangeEnrichment,
  type PREnrichment,
  type PRReviewer,
} from '@/app/api/wikiTypes';

interface EnrichmentPanelProps {
  sourceUri: string;
  selectedLines?: { start: number; end: number } | null;
  activeTab?: EnrichmentTab;
  /** Optional — needed for ChangesTab actions (commit/create-PR). */
  spaceId?: string;
  /** Optional — used by ChangesTab to highlight current file row. */
  currentFilePath?: string;
}

export const EnrichmentPanel: React.FC<EnrichmentPanelProps> = ({
  sourceUri,
  selectedLines,
  activeTab: initialTab,
  spaceId,
  currentFilePath,
}) => {
  const [activeTab, setActiveTab] = useState<EnrichmentTab>(
    initialTab ?? EnrichmentTab.Comments,
  );
  const [enrichments, setEnrichments] = useState<EnrichmentsResponse | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Load + subscribe
  useEffect(() => {
    if (!sourceUri) return;
    setError(false);

    const enrichSub = eventBus.on('wiki/enrichments/loaded', (payload) => {
      if (payload.sourceUri === sourceUri) {
        setEnrichments(payload.enrichments ?? {});
      }
    });
    const enrichErrSub = eventBus.on('wiki/enrichments/error', () => {
      setError(true);
    });
    const commentsSub = eventBus.on('wiki/comments/loaded', (payload) => {
      if (payload.sourceUri === sourceUri) {
        setComments(payload.comments ?? []);
      }
    });

    loadEnrichments(sourceUri);
    loadComments(sourceUri);

    return () => {
      enrichSub.unsubscribe();
      enrichErrSub.unsubscribe();
      commentsSub.unsubscribe();
    };
  }, [sourceUri]);

  const safeEnrichments: EnrichmentsResponse = enrichments ?? {};
  const commentCount = comments.length;
  const diffCount = safeEnrichments.diff?.length ?? 0;
  const prCount = safeEnrichments.pr_diff?.length ?? 0;
  const localCount = safeEnrichments.local_changes?.length ?? 0;
  const changesCount =
    (safeEnrichments.edit?.length ?? 0) + (safeEnrichments.commit?.length ?? 0);

  const tabs: Array<{ id: EnrichmentTab; label: string; icon: React.ReactNode; count: number }> = [
    {
      id: EnrichmentTab.Comments,
      label: 'Comments',
      icon: <MessageSquare size={16} />,
      count: commentCount,
    },
    {
      id: EnrichmentTab.Diffs,
      label: 'Diffs',
      icon: <FileEdit size={16} />,
      count: diffCount,
    },
    {
      id: EnrichmentTab.PRs,
      label: 'PRs',
      icon: <GitBranch size={16} />,
      count: prCount,
    },
    {
      id: EnrichmentTab.Local,
      label: 'Local',
      icon: <AlertCircle size={16} />,
      count: localCount,
    },
    {
      id: EnrichmentTab.Changes,
      label: 'Changes',
      icon: <Edit3 size={16} />,
      count: changesCount,
    },
  ];

  if (error && !enrichments && comments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-destructive text-sm">Failed to load enrichments</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex border-b border-border overflow-x-auto">
        {tabs
          .filter((tab) => tab.id === EnrichmentTab.Comments || tab.count > 0)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'text-foreground border-primary bg-accent'
                  : 'text-muted-foreground border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-xs rounded ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === EnrichmentTab.Comments && (
          <CommentsTab
            comments={comments}
            sourceUri={sourceUri}
            selectedLines={selectedLines ?? null}
          />
        )}

        {activeTab === EnrichmentTab.Diffs && (
          <DiffsTabContent diffs={safeEnrichments.diff ?? []} />
        )}

        {activeTab === EnrichmentTab.PRs && (
          <PRsTabContent prs={safeEnrichments.pr_diff ?? []} />
        )}

        {activeTab === EnrichmentTab.Local && (
          <LocalChangesTabContent changes={safeEnrichments.local_changes ?? []} />
        )}

        {activeTab === EnrichmentTab.Changes && (
          <ChangesTab
            editEnrichments={safeEnrichments.edit ?? []}
            commitEnrichments={safeEnrichments.commit ?? []}
            spaceId={spaceId}
            currentFilePath={currentFilePath}
            onRefresh={() => loadEnrichments(sourceUri)}
          />
        )}
      </div>
    </div>
  );
};

EnrichmentPanel.displayName = 'EnrichmentPanel';

// =============================================================================
// DiffsTabContent
// =============================================================================

function DiffsTabContent({ diffs }: { diffs: DiffEnrichment[] }) {
  if (diffs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileEdit size={32} className="mx-auto mb-2 opacity-50" />
        <div className="text-sm">No pending diffs</div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {diffs.map((diff) => (
        <div key={diff.id} className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{diff.file_path}</span>
            <span className="text-xs text-muted-foreground">
              +{diff.stats.additions} / -{diff.stats.deletions}
            </span>
          </div>
          {diff.diff_hunks.map((hunk, i) => (
            <div key={i} className="font-mono text-xs">
              <div className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                @@ -{hunk.old_start},{hunk.old_count} +{hunk.new_start},{hunk.new_count} @@
              </div>
              {hunk.lines.map((line, j) => {
                const isAdd = line.startsWith('+');
                const isDel = line.startsWith('-');
                const cls = isAdd
                  ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                  : isDel
                    ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                    : 'text-foreground';
                return (
                  <div
                    key={j}
                    className={`px-2 py-0.5 whitespace-pre-wrap break-all ${cls}`}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// PRsTabContent
// =============================================================================

function ReviewerBadge({ reviewer }: { reviewer: PRReviewer }) {
  const isApproved = reviewer.status === 'APPROVED';
  return (
    <div className="flex items-center gap-1.5" title={`${reviewer.display_name} — ${reviewer.status}`}>
      {reviewer.avatar_url ? (
        <img
          src={reviewer.avatar_url}
          alt={reviewer.display_name}
          className="w-5 h-5 rounded-full"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
          <User size={12} className="text-muted-foreground" />
        </div>
      )}
      <span className="text-xs text-foreground">{reviewer.display_name || reviewer.username}</span>
      {isApproved ? (
        <Check size={12} className="text-green-600" />
      ) : (
        <Clock size={12} className="text-yellow-600" />
      )}
    </div>
  );
}

function PRsTabContent({ prs }: { prs: PREnrichment[] }) {
  if (prs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GitPullRequest size={32} className="mx-auto mb-2 opacity-50" />
        <div className="text-sm">No pull requests</div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      {prs.map((pr) => (
        <div key={pr.pr_number} className="border border-border rounded-lg p-4 bg-muted">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{pr.pr_title}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
              #{pr.pr_number}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            by {pr.pr_author} · {pr.pr_state}
          </div>
          {pr.reviewers && pr.reviewers.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1.5">Reviewers</div>
              <div className="flex flex-wrap gap-2">
                {pr.reviewers.map((r) => (
                  <ReviewerBadge key={r.username} reviewer={r} />
                ))}
              </div>
            </div>
          )}
          {pr.pr_url && (
            <a
              href={pr.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-2 inline-block"
            >
              View PR →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// LocalChangesTabContent
// =============================================================================

function LocalChangesTabContent({ changes }: { changes: LocalChangeEnrichment[] }) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
        <div className="text-sm">No local changes</div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      {changes.map((change) => (
        <div key={change.id} className="border border-border rounded-lg p-3 bg-muted">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} className="text-yellow-600" />
            <span className="text-sm font-medium text-foreground">
              {change.commit_message || 'Local change'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{change.status}</span>
            <span>{new Date(change.created_at).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
