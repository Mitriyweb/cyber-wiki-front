/**
 * CommentsTab — sidebar panel for inline + document-level comments.
 *
 * Per FR cpt-cyberwiki-fr-inline-comments / cpt-cyberwiki-fr-comment-threads /
 * cpt-cyberwiki-fr-document-level-comments. Talks to the system through actions
 * (no direct API calls).
 *
 * Ported from doclab components/main-view/sidebar/CommentsTab.tsx.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { trim } from 'lodash';
import { ChevronDown, ChevronRight, FileText, MessageSquare, Send } from 'lucide-react';
import { Comment } from '@/app/components/enrichments/Comment';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';
import {
  createComment as createCommentAction,
  deleteComment as deleteCommentAction,
  resolveComment as resolveCommentAction,
} from '@/app/actions/enrichmentActions';
import type { CommentData } from '@/app/api';

interface CommentsTabProps {
  comments: CommentData[];
  sourceUri: string;
  selectedLines: { start: number; end: number } | null;
}

export function CommentsTab({ comments, sourceUri, selectedLines }: CommentsTabProps) {
  const [newCommentText, setNewCommentText] = useState('');
  const [newDocCommentText, setNewDocCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showDocCommentForm, setShowDocCommentForm] = useState(false);
  const [docCommentsExpanded, setDocCommentsExpanded] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const docComments = useMemo(
    () => comments.filter((c) => !c.line_start && !c.line_end),
    [comments],
  );
  const lineComments = useMemo(() => {
    const list = comments.filter((c) => c.line_start || c.line_end);
    list.sort((a, b) => (a.line_start || 0) - (b.line_start || 0));
    return list;
  }, [comments]);

  // Auto-expand selected line's thread
  useEffect(() => {
    if (!selectedLines) return;
    const match = lineComments.find(
      (c) => c.line_start === selectedLines.start && c.line_end === selectedLines.end,
    );
    if (match) {
      setExpandedThreads((prev) => new Set(prev).add(String(match.id)));
    }
  }, [selectedLines, lineComments]);

  const toggleThread = useCallback((id: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmitLine = useCallback(() => {
    if (!trim(newCommentText) || !selectedLines) return;
    setIsSubmitting(true);
    createCommentAction(sourceUri, newCommentText, selectedLines.start, selectedLines.end);
    setNewCommentText('');
    // optimistic clear; loading flag is short-lived (effect refreshes via wiki/comment/created)
    setIsSubmitting(false);
  }, [newCommentText, selectedLines, sourceUri]);

  const handleSubmitDoc = useCallback(() => {
    if (!trim(newDocCommentText)) return;
    setIsSubmitting(true);
    createCommentAction(sourceUri, newDocCommentText);
    setNewDocCommentText('');
    setShowDocCommentForm(false);
    setIsSubmitting(false);
  }, [newDocCommentText, sourceUri]);

  const handleSubmitReply = useCallback(
    (parentId: string, text: string) => {
      if (!trim(text)) return;
      setIsSubmitting(true);
      createCommentAction(sourceUri, text, undefined, undefined, parentId);
      setIsSubmitting(false);
    },
    [sourceUri],
  );

  const handleDelete = useCallback((commentId: string) => {
    setPendingDelete(commentId);
  }, []);

  const handleResolve = useCallback(
    (commentId: string, isResolved: boolean) => {
      resolveCommentAction(commentId, isResolved, sourceUri);
    },
    [sourceUri],
  );

  return (
    <>
      <ConfirmDialog
        open={pendingDelete !== null}
        message="Delete this comment?"
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (pendingDelete) {
            deleteCommentAction(pendingDelete, sourceUri);
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-auto px-4 py-3">
          {/* Document Comments */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setDocCommentsExpanded((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-80"
              >
                {docCommentsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <FileText size={16} />
                Document Comments ({docComments.length})
              </button>
              {docCommentsExpanded && !showDocCommentForm && (
                <button
                  type="button"
                  onClick={() => setShowDocCommentForm(true)}
                  className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Add Comment
                </button>
              )}
            </div>

            {docCommentsExpanded && showDocCommentForm && (
              <div className="mb-3 p-3 border border-border rounded-lg bg-muted">
                <textarea
                  value={newDocCommentText}
                  onChange={(e) => setNewDocCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmitDoc();
                    }
                  }}
                  placeholder="Comment on the entire document… (Ctrl+Enter to submit)"
                  className="w-full px-3 py-2 text-sm border border-border rounded resize-none h-20 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDocCommentForm(false);
                      setNewDocCommentText('');
                    }}
                    className="px-3 py-1.5 text-sm rounded text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitDoc}
                    disabled={!trim(newDocCommentText) || isSubmitting}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={14} />
                    Post Comment
                  </button>
                </div>
              </div>
            )}

            {docCommentsExpanded && docComments.length > 0 && (
              <div className="space-y-2">
                {docComments.map((c) => (
                  <div
                    key={c.id}
                    className="border border-border rounded-lg overflow-hidden bg-muted"
                  >
                    <Comment
                      comment={c}
                      onDelete={handleDelete}
                      onResolve={handleResolve}
                      onReply={handleSubmitReply}
                      isSubmitting={isSubmitting}
                    />
                  </div>
                ))}
              </div>
            )}
            {docCommentsExpanded && docComments.length === 0 && !showDocCommentForm && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                No document comments yet
              </div>
            )}
          </div>

          {/* Line Comments */}
          {lineComments.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="text-sm font-medium text-foreground mb-3">
                Line Comments ({lineComments.length})
              </div>
              <div className="space-y-3">
                {lineComments.map((c) => {
                  const cid = String(c.id);
                  const isExpanded = expandedThreads.has(cid);
                  const isSelected =
                    !!selectedLines &&
                    c.line_start === selectedLines.start &&
                    c.line_end === selectedLines.end;
                  const replyCount = c.replies?.length ?? 0;
                  const totalCount = 1 + replyCount;
                  return (
                    <div
                      key={c.id}
                      className={`rounded-lg overflow-hidden bg-muted ${
                        isSelected ? 'border-2 border-primary' : 'border border-border'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleThread(cid)}
                        className={`w-full px-3 py-2 border-b border-border text-xs font-medium flex items-center justify-between hover:opacity-80 ${
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'bg-background text-muted-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          Line {c.line_start} • {totalCount} comment
                          {totalCount > 1 ? 's' : ''}
                        </span>
                      </button>

                      {isExpanded && (
                        <Comment
                          comment={c}
                          onDelete={handleDelete}
                          onResolve={handleResolve}
                          onReply={handleSubmitReply}
                          isSubmitting={isSubmitting}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {comments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <div className="text-sm">No comments yet</div>
              {!selectedLines && (
                <div className="text-xs mt-1">Click a line to add a comment</div>
              )}
            </div>
          )}
        </div>

        {/* Inline new-comment form */}
        {selectedLines && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-muted">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Add comment to{' '}
              {selectedLines.start === selectedLines.end
                ? `Line ${selectedLines.start}`
                : `Lines ${selectedLines.start}-${selectedLines.end}`}
            </div>
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmitLine();
                }
              }}
              placeholder="Enter your comment… (Ctrl+Enter to submit)"
              className="w-full px-3 py-2 text-sm border border-border rounded resize-none h-20 max-h-[7.5rem] bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={handleSubmitLine}
                disabled={!trim(newCommentText) || isSubmitting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                Post Comment
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
