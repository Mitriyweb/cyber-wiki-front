/**
 * PRsPage — global list of open PRs across all visible spaces.
 * Supports filtering by author, reviewer, and free-text search.
 */

import { useEffect, useMemo, useState } from 'react';
import { eventBus } from '@cyberfabric/react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  GitPullRequest,
  Search,
  User,
} from 'lucide-react';
import { loadPullRequests } from '@/app/actions/wikiActions';
import { PageTitle } from '@/app/layout';
import { Urls, type MyReviewPR, type PRReviewer } from '@/app/api';

interface PRsPageProps {
  navigate: (view: string) => void;
}

interface SpaceGroup {
  spaceSlug: string;
  spaceName: string;
  prs: MyReviewPR[];
}

function groupBySpace(prs: MyReviewPR[]): SpaceGroup[] {
  const map = new Map<string, SpaceGroup>();
  for (const pr of prs) {
    let group = map.get(pr.space_slug);
    if (!group) {
      group = { spaceSlug: pr.space_slug, spaceName: pr.space_name, prs: [] };
      map.set(pr.space_slug, group);
    }
    group.prs.push(pr);
  }
  for (const g of map.values()) {
    g.prs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return Array.from(map.values()).sort((a, b) => a.spaceSlug.localeCompare(b.spaceSlug));
}

function ReviewerChip({ reviewer }: { reviewer: PRReviewer }) {
  const isApproved = reviewer.status === 'APPROVED';
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-accent"
      title={`${reviewer.display_name || reviewer.username} — ${reviewer.status}`}
    >
      {reviewer.avatar_url ? (
        <img src={reviewer.avatar_url} alt="" className="w-4 h-4 rounded-full" />
      ) : (
        <User size={10} className="text-muted-foreground" />
      )}
      <span className="text-foreground">{reviewer.display_name || reviewer.username}</span>
      {isApproved ? (
        <Check size={10} className="text-green-600" />
      ) : (
        <Clock size={10} className="text-yellow-600" />
      )}
    </span>
  );
}

/** Collect unique author usernames from PRs. */
function collectAuthors(prs: MyReviewPR[]): string[] {
  const set = new Set<string>();
  for (const pr of prs) {
    if (pr.author) set.add(pr.author);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Collect unique reviewer usernames from PRs. */
function collectReviewers(prs: MyReviewPR[]): string[] {
  const set = new Set<string>();
  for (const pr of prs) {
    for (const r of pr.reviewers) {
      if (r.username) set.add(r.username);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function PRsPage({ navigate }: PRsPageProps) {
  const [prs, setPrs] = useState<MyReviewPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [reviewerFilter, setReviewerFilter] = useState('me');
  const [currentGitUsernames, setCurrentGitUsernames] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);

    const loadedSub = eventBus.on('wiki/my-reviews/loaded', ({ pullRequests, currentGitUsernames: usernames }) => {
      setPrs(pullRequests);
      setCurrentGitUsernames(usernames);
      setLoading(false);
      // Expand all groups by default
      const slugs = new Set(pullRequests.map((pr) => pr.space_slug));
      setExpandedGroups(slugs);
    });
    const errorSub = eventBus.on('wiki/my-reviews/error', ({ error: msg }) => {
      setError(msg);
      setLoading(false);
    });

    loadPullRequests();

    return () => {
      loadedSub.unsubscribe();
      errorSub.unsubscribe();
    };
  }, []);

  const authors = useMemo(() => collectAuthors(prs), [prs]);
  const reviewers = useMemo(() => collectReviewers(prs), [prs]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = prs.filter((pr) => {
      if (authorFilter !== 'all' && pr.author !== authorFilter) return false;
      if (reviewerFilter === 'me') {
        const meSet = new Set(currentGitUsernames.map((u) => u.toLowerCase()));
        const hasMe = pr.reviewers.some((r) => meSet.has(r.username.toLowerCase()));
        if (!hasMe) return false;
      } else if (reviewerFilter !== 'all') {
        const hasReviewer = pr.reviewers.some((r) => r.username === reviewerFilter);
        if (!hasReviewer) return false;
      }
      if (q) {
        const match =
          pr.title.toLowerCase().includes(q) ||
          pr.author.toLowerCase().includes(q) ||
          pr.space_slug.toLowerCase().includes(q) ||
          pr.space_name.toLowerCase().includes(q) ||
          String(pr.number).includes(q);
        if (!match) return false;
      }
      return true;
    });
    return groupBySpace(filtered);
  }, [prs, search, authorFilter, reviewerFilter, currentGitUsernames]);

  const total = prs.length;
  const filteredTotal = groups.reduce((sum, g) => sum + g.prs.length, 0);

  const toggleGroup = (slug: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleOpenSpace = (spaceSlug: string) => {
    navigate(`${Urls.Spaces}?space=${spaceSlug}`);
  };

  return (
    <div className="h-full overflow-auto">
      <PageTitle title="Pull Requests" subtitle="Open pull requests across the spaces you have access to." />
      <div className="max-w-7xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, author, space, or PR number..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
              title="Filter by author"
            >
              <option value="all">All authors</option>
              {authors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={reviewerFilter}
              onChange={(e) => setReviewerFilter(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
              title="Filter by reviewer"
            >
              <option value="me">My reviews</option>
              <option value="all">All reviewers</option>
              {reviewers.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {!loading && !error && total === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <GitPullRequest size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No open pull requests.</p>
            <p className="text-xs mt-1">
              There are no open PRs across the spaces you have access to.
            </p>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <>
            <div className="text-xs text-muted-foreground">
              {filteredTotal === total
                ? `${total} open PR${total === 1 ? '' : 's'}`
                : `${filteredTotal} of ${total} shown`}
            </div>

            <div className="space-y-2">
              {groups.map((group) => {
                const isOpen = expandedGroups.has(group.spaceSlug);
                return (
                  <div
                    key={group.spaceSlug}
                    className="border border-border rounded-lg bg-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.spaceSlug)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent/50 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <GitPullRequest size={14} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate flex-1">
                        {group.spaceName || group.spaceSlug}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {group.prs.length}
                      </span>
                    </button>

                    {isOpen && (
                      <ul className="divide-y divide-border border-t border-border">
                        {group.prs.map((pr) => (
                          <li key={pr.number}>
                            <div className="flex items-start gap-3 px-4 py-3 hover:bg-accent/40">
                              <GitPullRequest size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-foreground truncate">
                                    {pr.title}
                                  </span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground flex-shrink-0">
                                    #{pr.number}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  <span>by {pr.author}</span>
                                  {pr.from_branch && <span>· {pr.from_branch}</span>}
                                  <span>· {new Date(pr.created_at).toLocaleDateString()}</span>
                                </div>
                                {pr.reviewers.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {pr.reviewers.map((r) => (
                                      <ReviewerChip key={r.username} reviewer={r} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSpace(group.spaceSlug)}
                                  className="text-xs text-primary hover:underline"
                                  title="Open space"
                                >
                                  Open space
                                </button>
                                {pr.url && (
                                  <a
                                    href={pr.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                    title="Open in Git provider"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PRsPage;
