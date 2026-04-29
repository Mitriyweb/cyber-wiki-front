/**
 * Shared test utilities for virtual content unit tests.
 *
 * Mirrors the enrichment shapes that FileViewer produces:
 * one Enrichment per hunk, with `current_hunk` set in `data`.
 */

import {
  Enrichment,
  EnrichmentType,
  LayeredVirtualContent,
} from '@/app/api/wikiTypes';
import { VirtualContentBuilder } from '@/app/lib/VirtualContentBuilder';

// ---------------------------------------------------------------------------
// Hunk
// ---------------------------------------------------------------------------

export interface DiffHunk {
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: string[]; // each line prefixed with ' ', '-', or '+'
}

export function makeHunk(
  old_start: number,
  old_count: number,
  new_start: number,
  new_count: number,
  lines: string[]
): DiffHunk {
  return { old_start, old_count, new_start, new_count, lines };
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Join lines with '\n' to produce file content. */
export function makeContent(lines: string[]): string {
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Enrichment factories — match what FileViewer emits (one per hunk)
// ---------------------------------------------------------------------------

export function makeEditEnrichment(hunk: DiffHunk, editId = 'test-edit-id'): Enrichment {
  return {
    id: `edit-hunk-${hunk.old_start}`,
    type: EnrichmentType.Edit,
    lineStart: hunk.old_start,
    lineEnd: hunk.old_start,
    data: { id: editId, file_path: 'test.md', current_hunk: hunk },
  };
}

export function makePREnrichment(hunk: DiffHunk, prNumber = 42): Enrichment {
  return {
    id: `pr-hunk-${hunk.old_start}`,
    type: EnrichmentType.PRDiff,
    lineStart: hunk.old_start,
    lineEnd: hunk.old_start,
    data: { pr_number: prNumber, pr_title: 'Test PR', current_hunk: hunk },
  };
}

export function makeCommitEnrichment(hunk: DiffHunk, commitSha = 'abc1234def'): Enrichment {
  return {
    id: `commit-hunk-${hunk.old_start}`,
    type: EnrichmentType.Commit,
    lineStart: hunk.old_start,
    lineEnd: hunk.old_start,
    data: { commit_sha: commitSha, current_hunk: hunk },
  };
}

export function makeCommentEnrichment(
  lineStart: number,
  lineEnd: number,
  commentId = 'test-comment'
): Enrichment {
  return {
    id: commentId,
    type: EnrichmentType.Comment,
    lineStart,
    lineEnd,
    data: { id: commentId, text: 'Test comment', author: 'test-user' },
  };
}

// ---------------------------------------------------------------------------
// Builder helper
// ---------------------------------------------------------------------------

export function buildVirtualContent(
  content: string,
  enrichments: Enrichment[]
): LayeredVirtualContent {
  return new VirtualContentBuilder(content, enrichments, {
    detectConflicts: true,
    enrichmentOrder: [EnrichmentType.PRDiff, EnrichmentType.Commit, EnrichmentType.Edit],
  }).build();
}
