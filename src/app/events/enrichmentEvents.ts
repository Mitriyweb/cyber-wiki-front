/**
 * Enrichment Events
 * Event type declarations for enrichment domain (enrichments, comments)
 */

import '@cyberfabric/react';
import type {
  EnrichmentsResponse,
  CommentData,
} from '@/app/api';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Load enrichments for a source URI */
    'wiki/enrichments/load': { sourceUri: string };
    /** Enrichments loaded */
    'wiki/enrichments/loaded': { sourceUri: string; enrichments: EnrichmentsResponse };
    /** Enrichments load error */
    'wiki/enrichments/error': { error: string };

    /** Load comments for a source URI */
    'wiki/comments/load': { sourceUri: string };
    /** Comments loaded */
    'wiki/comments/loaded': { sourceUri: string; comments: CommentData[] };

    /** Load every comment the user can see (no source_uri filter) */
    'wiki/comments/all/load': { isResolved?: boolean };
    /** All comments loaded */
    'wiki/comments/all/loaded': { comments: CommentData[] };
    /** Create a comment */
    'wiki/comment/create': {
      sourceUri: string;
      text: string;
      lineStart?: number;
      lineEnd?: number;
      parentComment?: string;
    };
    /** Comment created */
    'wiki/comment/created': { comment: CommentData };
    /** Delete a comment */
    'wiki/comment/delete': { commentId: string; sourceUri: string };
    /** Comment deleted */
    'wiki/comment/deleted': { commentId: string };
    /** Resolve / unresolve a comment */
    'wiki/comment/resolve': { commentId: string; isResolved: boolean; sourceUri: string };
    /** Comment resolved/unresolved */
    'wiki/comment/resolved': { comment: CommentData };
    /** Comment operation error */
    'wiki/comment/error': { error: string };

    /** A line was clicked in Visual mode */
    'wiki/enrichments/line-selected': { lineNumber: number };
  }
}
