/**
 * Enrichment Converter
 *
 * Converts backend EnrichmentsResponse into the flat Enrichment[]
 * format consumed by VirtualContentBuilder.
 */

import {
  EnrichmentType,
  type Enrichment,
  type EnrichmentPayload,
  type EnrichmentsResponse,
  type CommentData,
  type PREnrichment,
  type EditEnrichment,
  type CommitEnrichment,
} from '@/app/api/wikiTypes';

function commentToEnrichment(comment: CommentData): Enrichment {
  return {
    id: comment.id,
    type: EnrichmentType.Comment,
    lineStart: comment.line_start ?? 0,
    lineEnd: comment.line_end ?? comment.line_start ?? 0,
    data: {
      text: comment.text,
      user: comment.author_username ?? 'Unknown',
      thread_id: comment.thread_id,
      is_resolved: comment.is_resolved,
      created_at: comment.created_at,
    } as EnrichmentPayload,
  };
}

function prToEnrichments(pr: PREnrichment): Enrichment[] {
  if (!pr.diff_hunks || pr.diff_hunks.length === 0) return [];
  const lineStart = Math.min(...pr.diff_hunks.map((h) => h.old_start));
  const lineEnd = Math.max(...pr.diff_hunks.map((h) => h.old_start + Math.max(h.old_count - 1, 0)));
  return [{
    id: `pr-${pr.pr_number}`,
    type: EnrichmentType.PRDiff,
    lineStart,
    lineEnd,
    data: {
      pr_number: pr.pr_number,
      pr_title: pr.pr_title,
      pr_author: pr.pr_author,
      pr_state: pr.pr_state,
      pr_url: pr.pr_url,
      diff_hunks: pr.diff_hunks,
    } as EnrichmentPayload,
  }];
}

function editToEnrichments(edit: EditEnrichment): Enrichment[] {
  if (!edit.diff_hunks || edit.diff_hunks.length === 0) return [];
  const lineStart = Math.min(...edit.diff_hunks.map((h) => h.old_start));
  const lineEnd = Math.max(...edit.diff_hunks.map((h) => h.old_start + Math.max(h.old_count - 1, 0)));
  return [{
    id: edit.id,
    type: EnrichmentType.Edit,
    lineStart,
    lineEnd,
    data: {
      id: edit.id,
      change_type: edit.change_type,
      description: edit.description,
      user: edit.user,
      diff_hunks: edit.diff_hunks,
      actions: edit.actions,
    } as EnrichmentPayload,
  }];
}

function commitToEnrichments(commit: CommitEnrichment): Enrichment[] {
  if (!commit.diff_hunks || commit.diff_hunks.length === 0) return [];
  const lineStart = Math.min(...commit.diff_hunks.map((h) => h.old_start));
  const lineEnd = Math.max(...commit.diff_hunks.map((h) => h.old_start + Math.max(h.old_count - 1, 0)));
  return [{
    id: commit.id,
    type: EnrichmentType.Commit,
    lineStart,
    lineEnd,
    data: {
      commit_sha: commit.commit_sha,
      branch_name: commit.branch_name,
      user: commit.user,
      diff_hunks: commit.diff_hunks,
      actions: commit.actions,
    } as EnrichmentPayload,
  }];
}

export function convertEnrichmentsResponse(response: EnrichmentsResponse): Enrichment[] {
  const result: Enrichment[] = [];

  if (response.comments) {
    for (const c of response.comments) {
      if (c.line_start !== null) {
        result.push(commentToEnrichment(c));
      }
    }
  }

  if (response.pr_diff) {
    for (const pr of response.pr_diff) {
      result.push(...prToEnrichments(pr));
    }
  }

  if (response.edit) {
    for (const edit of response.edit) {
      result.push(...editToEnrichments(edit));
    }
  }

  if (response.commit) {
    for (const commit of response.commit) {
      result.push(...commitToEnrichments(commit));
    }
  }

  return result;
}
