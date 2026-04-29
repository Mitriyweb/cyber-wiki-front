/**
 * Wiki Domain - API Types
 * Type definitions for wiki service endpoints
 * (spaces, file trees, documents, comments)
 */

// =============================================================================
// URL / Route constants
// =============================================================================

export enum Urls {
  Dashboard = 'dashboard',
  Spaces = 'spaces',
  SpaceConfiguration = 'space-configuration',
  Profile = 'profile',
  Tokens = 'tokens',
  Configuration = 'configuration',
  Comments = 'comments',
  Changes = 'changes',
  PRs = 'prs',
}

// =============================================================================
// Spaces
// =============================================================================

export enum SpaceVisibility {
  Private = 'private',
  Team = 'team',
  Public = 'public',
}

export enum SpacePermissionRole {
  Viewer = 'viewer',
  Editor = 'editor',
  Admin = 'admin',
}

export enum GitProvider {
  GitHub = 'github',
  BitbucketServer = 'bitbucket_server',
  LocalGit = 'local_git',
}

export type Space = {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner: number;
  owner_username: string;
  created_by: number | null;
  created_by_username: string | null;
  visibility: SpaceVisibility;
  is_public: boolean;
  git_provider: GitProvider | null;
  git_base_url: string | null;
  git_project_key: string | null;
  git_repository_id: string | null;
  git_repository_name: string | null;
  git_default_branch: string;
  edit_fork_project_key: string | null;
  edit_fork_repo_slug: string | null;
  edit_fork_ssh_url: string | null;
  edit_fork_local_path: string | null;
  edit_enabled: boolean;
  filters: string[];
  default_display_name_source: string;
  page_count: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

export type UserSpacePreference = {
  id: string;
  user: number;
  user_username: string;
  space: string;
  space_slug: string;
  space_name: string;
  is_favorite: boolean;
  last_visited_at: string;
  visit_count: number;
  last_viewed_page_id: number | null;
};

// =============================================================================
// File Tree
// =============================================================================

export enum TreeNodeType {
  File = 'file',
  Dir = 'dir',
}

export type TreeNode = {
  name: string;
  path: string;
  type: TreeNodeType;
  children?: TreeNode[];
  display_name?: string;
  display_name_source?: string;
  is_visible?: boolean;
  has_mapping?: boolean;
  icon?: string;
  sort_order?: number;
};

export enum ViewMode {
  Dev = 'dev',
  Documents = 'documents',
}

export enum FileViewMode {
  Preview = 'preview',
  Source = 'source',
  Visual = 'visual',
  /** Unified-diff render of the on-disk content against the unsaved draft. */
  Diff = 'diff',
}

// =============================================================================
// Virtual Content (Enriched View)
// =============================================================================

export enum DiffType {
  Addition = 'addition',
  Deletion = 'deletion',
}

export type VirtualLine = {
  lineNumber: number;
  virtualLineNumber: number;
  content: string;
  enrichments: Enrichment[];
  sourceEnrichment?: Enrichment;
  isOriginalLine: boolean;
  isInsertedLine: boolean;
  diffType?: DiffType;
  isFirstInDiffGroup?: boolean;
  hasConflict?: boolean;
  prNumber?: number;
  prTitle?: string;
  commitSha?: string;
  editId?: string;
  layerIndex: number;
  previousLayerLine?: number;
};

export type DiffHunkRaw = {
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: string[];
};

export interface EnrichmentPayload {
  current_hunk?: DiffHunkRaw;
  diff_hunks?: DiffHunkRaw[];
  id?: string;
  pr_number?: number;
  pr_title?: string;
  pr_author?: string;
  pr_state?: string;
  pr_url?: string;
  commit_sha?: string;
  actions?: string[];
  firstEnrichment?: Enrichment;
  secondEnrichment?: Enrichment;
  hunk?: DiffHunkRaw;
  [key: string]: string | number | boolean | null | undefined | string[] | DiffHunkRaw[] | DiffHunkRaw | Enrichment | Enrichment[];
}

export type Enrichment = {
  id: string;
  type: string;
  lineStart: number;
  lineEnd: number;
  data: EnrichmentPayload;
};

export type VirtualContentLayer = {
  layerIndex: number;
  enrichment?: Enrichment;
  lines: VirtualLine[];
};

export type LayeredVirtualContent = {
  originalContent: string;
  originalLines: string[];
  layers: VirtualContentLayer[];
  finalLines: VirtualLine[];
  enrichments: Enrichment[];
  enrichmentsByType: Map<string, Enrichment[]>;
  hasConflicts: boolean;
  conflictLines: Set<number>;
  stats: {
    totalLayers: number;
    totalLines: number;
    insertedLines: number;
    conflictCount: number;
  };
};

export enum FileType {
  Markdown = 'markdown',
  Yaml = 'yaml',
  Code = 'code',
  PlainText = 'plaintext',
}

const CODE_EXTENSIONS: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  mjs: 'javascript', cjs: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
  kt: 'kotlin', kts: 'kotlin', scala: 'scala', groovy: 'groovy',
  swift: 'swift', m: 'objectivec', mm: 'objectivec',
  php: 'php', pl: 'perl', pm: 'perl',
  lua: 'lua', r: 'r', jl: 'julia',
  dart: 'dart', ex: 'elixir', exs: 'elixir', erl: 'erlang',
  hs: 'haskell', ml: 'ocaml', fs: 'fsharp', clj: 'clojure',
  zig: 'zig', nim: 'nim', v: 'v',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'powershell', psm1: 'powershell',
  json: 'json', jsonc: 'json', json5: 'json5',
  xml: 'xml', svg: 'xml', xsl: 'xml', xhtml: 'xml',
  html: 'html', htm: 'html', vue: 'html',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  sql: 'sql', graphql: 'graphql', gql: 'graphql',
  toml: 'toml', ini: 'ini', cfg: 'ini', env: 'ini',
  md: 'markdown', mdx: 'markdown', yml: 'yaml', yaml: 'yaml',
  dockerfile: 'docker', makefile: 'make',
  proto: 'protobuf', thrift: 'thrift',
  tf: 'hcl', hcl: 'hcl',
  diff: 'diff', patch: 'diff',
  tex: 'latex', bib: 'latex',
  rst: 'rest', adoc: 'asciidoc',
  cmake: 'cmake',
};

export function detectFileType(fileName: string): FileType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdx')) {
    return FileType.Markdown;
  }
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) {
    return FileType.Yaml;
  }
  const ext = lower.split('.').pop() || '';
  if (CODE_EXTENSIONS[ext]) {
    return FileType.Code;
  }
  if (lower.endsWith('.txt') || lower.endsWith('.log') || lower === 'license' || lower === 'notice') {
    return FileType.PlainText;
  }
  return ext ? FileType.Code : FileType.PlainText;
}

export function getLanguageLabel(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return CODE_EXTENSIONS[ext] || ext || 'text';
}

// =============================================================================
// Request / Response types
// =============================================================================

export type CreateSpaceRequest = {
  slug: string;
  name: string;
  description?: string;
  visibility?: SpaceVisibility;
  git_provider?: string;
  git_repository_url?: string;
  git_default_branch?: string;
};

export type UpdateSpaceRequest = {
  name?: string;
  description?: string;
  visibility?: SpaceVisibility;
  git_provider?: string;
  git_repository_url?: string;
  git_default_branch?: string;
  edit_fork_project_key?: string;
  edit_fork_repo_slug?: string;
  edit_fork_ssh_url?: string;
  edit_fork_local_path?: string;
};

export type FileTreeResponse = {
  tree: TreeNode[];
};

// =============================================================================
// File Mapping
// =============================================================================

export enum DisplayNameSource {
  Custom = 'custom',
  Filename = 'filename',
  FirstH1 = 'first_h1',
  FirstH2 = 'first_h2',
  TitleFrontmatter = 'title_frontmatter',
}

export type FileMapping = {
  id: string;
  space: string;
  space_slug: string;
  file_path: string;
  is_folder: boolean;
  is_visible: boolean;
  display_name: string | null;
  display_name_source: DisplayNameSource;
  children_display_name_source: string | null;
  extracted_name: string | null;
  extracted_at: string | null;
  effective_display_name: string;
  effective_display_name_source: string | null;
  effective_is_visible: boolean;
  sort_order: number | null;
  icon: string | null;
  apply_to_children: boolean;
  parent_rule: string | null;
  is_override: boolean;
  created_at: string;
  updated_at: string;
};

export type FileMappingCreate = {
  file_path: string;
  is_folder: boolean;
  is_visible: boolean;
  display_name?: string | null;
  display_name_source: DisplayNameSource;
  sort_order?: number | null;
  icon?: string | null;
  apply_to_children?: boolean;
  is_override?: boolean;
};

export type ExtractedName = {
  file_path: string;
  extracted_name: string;
  source: string;
  error?: string;
};

export type ExtractNamesResponse = {
  extracted: ExtractedName[];
};

export enum ExtractNameSource {
  Filename = 'filename',
  FirstH1 = 'first_h1',
  FirstH2 = 'first_h2',
  TitleFrontmatter = 'title_frontmatter',
}

// =============================================================================
// Enrichments
// =============================================================================

export enum EnrichmentType {
  Comment = 'comment',
  Diff = 'diff',
  PRDiff = 'pr_diff',
  LocalChange = 'local_change',
  Edit = 'edit',
  Commit = 'commit',
  Conflict = 'conflict',
}

export type CommentUser = {
  username: string;
};

export type CommentData = {
  id: string;
  source_uri: string;
  line_start: number | null;
  line_end: number | null;
  text: string;
  /** Author user id (numeric, from Django auth_user). */
  author?: number | null;
  /** Author username — the field actually populated by the backend. */
  author_username?: string | null;
  thread_id: string;
  parent_comment: string | null;
  is_resolved: boolean;
  anchoring_status: string;
  created_at: string;
  updated_at: string;
  replies?: CommentData[];
};

export type DiffHunk = {
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: string[];
};

export type DiffEnrichment = {
  type: EnrichmentType.Diff;
  id: string;
  file_path: string;
  description: string;
  status: string;
  diff_hunks: DiffHunk[];
  diff_text: string;
  created_at: string;
  updated_at: string;
  stats: {
    additions: number;
    deletions: number;
    total_changes: number;
  };
};

export type LocalChangeEnrichment = {
  type: EnrichmentType.LocalChange;
  id: number;
  file_path: string;
  commit_message: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PRReviewer = {
  username: string;
  display_name: string;
  avatar_url: string;
  role: string;
  status: string;
};

export type PREnrichment = {
  type: EnrichmentType.PRDiff;
  pr_number: number;
  pr_title: string;
  pr_author: string;
  pr_state: string;
  pr_url: string;
  created_at: string;
  reviewers?: PRReviewer[];
  diff_hunks?: DiffHunk[];
};

export type MyReviewPR = {
  space_slug: string;
  space_name: string;
  number: number;
  title: string;
  state: string;
  author: string;
  url: string;
  created_at: string;
  updated_at: string;
  merged: boolean;
  from_branch?: string;
  reviewers: PRReviewer[];
};

export type MyReviewsResponse = {
  pull_requests: MyReviewPR[];
  current_git_usernames?: string[];
};

export enum EditChangeType {
  Modify = 'modify',
  Create = 'create',
  Delete = 'delete',
}

export type EditEnrichment = {
  type: EnrichmentType.Edit;
  id: string;
  space_id: string;
  space_slug: string;
  file_path: string;
  change_type: EditChangeType;
  description: string;
  user: string;
  user_full_name: string;
  created_at: string;
  updated_at: string;
  diff_hunks?: DiffHunk[];
  actions: ('commit' | 'discard')[];
};

export enum CommitAction {
  Unstage = 'unstage',
  CreatePr = 'create_pr',
  ViewPr = 'view_pr',
}

export type CommitEnrichment = {
  type: EnrichmentType.Commit;
  id: string;
  space_id: string;
  space_slug: string;
  file_path: string;
  branch_name: string;
  base_branch: string;
  task_name?: string | null;
  commit_sha: string | null;
  user: string;
  user_full_name: string;
  created_at: string;
  updated_at: string;
  diff_hunks?: DiffHunk[];
  additions?: number;
  deletions?: number;
  pr_id?: number | null;
  pr_url?: string | null;
  actions: CommitAction[];
};

export type EnrichmentsResponse = {
  comments?: CommentData[];
  diff?: DiffEnrichment[];
  local_changes?: LocalChangeEnrichment[];
  pr_diff?: PREnrichment[];
  edit?: EditEnrichment[];
  commit?: CommitEnrichment[];
};

export enum EnrichmentTab {
  All = 'all',
  Comments = 'comments',
  Diffs = 'diffs',
  PRs = 'prs',
  Local = 'local',
  Changes = 'changes',
}

// =============================================================================
// User Branches (per-user task branches)
// =============================================================================

export enum UserTaskStatus {
  Active = 'active',
  PrOpen = 'pr_open',
  Abandoned = 'abandoned',
}

export type UserTaskInfo = {
  id: string;
  name: string;
  branch_name: string;
  base_branch: string;
  status: UserTaskStatus;
  is_selected: boolean;
  last_commit_sha: string | null;
  pr_id: string | null;
  pr_url: string | null;
  conflict_files: string[];
  files_count: number;
  files: string[];
  draft_count: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceResponse = {
  tasks: UserTaskInfo[];
  selected_task_id: string | null;
  unassigned_draft_count: number;
  edit_enabled: boolean;
};

export type CreatePrResult = {
  pr_id: string;
  pr_url: string;
  branch_name: string;
};

// =============================================================================
// Draft Changes (user edits not yet committed to git)
// =============================================================================

export type DraftChangeListItem = {
  id: string;
  space_id: string;
  space_slug: string;
  file_path: string;
  change_type: EditChangeType;
  description: string;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DraftChange = {
  id: string;
  space_id: string;
  space_slug: string;
  file_path: string;
  change_type: EditChangeType;
  original_content?: string;
  modified_content?: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type SaveDraftChangeRequest = {
  space_id: string;
  file_path: string;
  original_content: string;
  modified_content: string;
  change_type: EditChangeType;
  description: string;
};

export type SaveDraftChangeResponse = {
  id: string;
  created: boolean;
};

export type CommitDraftChangesRequest = {
  change_ids: string[];
  commit_message?: string;
};

export type CommitDraftChangesResult = {
  success: boolean;
  message?: string;
  commit_sha: string | null;
  branch_name: string;
  files_committed: number;
  space_id: string;
  space_slug: string;
};

// =============================================================================
// Service Tokens
// =============================================================================

export enum ServiceType {
  GitHub = 'github',
  BitbucketServer = 'bitbucket_server',
  Jira = 'jira',
  CustomHeader = 'custom_header',
}

export type ServiceToken = {
  id: string;
  service_type: ServiceType;
  base_url: string | null;
  username: string | null;
  header_name: string | null;
  name: string | null;
  has_token: boolean;
  created_at: string;
  updated_at: string;
  last_validated_at: string | null;
  last_validation_valid: boolean | null;
  last_validation_message: string | null;
};

export type ServiceTokenCreate = {
  service_type: ServiceType;
  base_url?: string;
  token?: string;
  username?: string;
  header_name?: string;
  name?: string;
};

export type TokenValidationResult = {
  valid: boolean;
  message: string;
  details: Record<string, unknown>;
};

// =============================================================================
// API Tokens (per-user personal access tokens)
// =============================================================================

export type ApiToken = {
  id: string; // UUID
  name: string;
  /** Plaintext token — only returned on creation. */
  token?: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
};

export type ApiTokenCreate = {
  name: string;
  expires_in_days?: number;
};

// =============================================================================
// Cache Settings (backend-persisted per-user)
// =============================================================================

export type CacheSettings = {
  cache_enabled: boolean;
  cache_ttl_minutes: number;
};

// =============================================================================
// User Settings (UI-only state persisted in localStorage)
// =============================================================================

export enum ThemeMode {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

export type SpaceViewModes = Record<string, ViewMode>;

export type UserSettings = {
  /** Last selected sidebar mode per space slug. */
  spaceViewModes: SpaceViewModes;
  /** Whether the right enrichments panel is pinned open. */
  enrichmentsPinned: boolean;
  /** Last opened file path per space slug. */
  lastOpenedPath: Record<string, string>;
  /** UI theme. */
  theme: ThemeMode;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  spaceViewModes: {},
  enrichmentsPinned: false,
  lastOpenedPath: {},
  theme: ThemeMode.System,
};

/**
 * Build a canonical source URI recognised by the enrichment / comment backend.
 * Format: git://{provider}/{projectKey}_{repoSlug}/{branch}/{path}
 */
export function buildSourceUri(space: Space, filePath: string): string {
  const provider = space.git_provider ?? 'local_git';
  const repo = `${space.git_project_key ?? ''}_${space.git_repository_id ?? ''}`;
  const branch = space.git_default_branch || 'main';
  return `git://${provider}/${repo}/${branch}/${filePath}`;
}
