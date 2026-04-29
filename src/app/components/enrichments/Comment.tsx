/**
 * Comment — recursive comment component with replies, resolve, and delete.
 */

import { useState } from 'react';
import { trim } from 'lodash';
import { Send, Trash2, CheckCircle, MessageSquare } from 'lucide-react';
import type { CommentData } from '@/app/api/wikiTypes';

interface CommentProps {
  comment: CommentData;
  onDelete: (commentId: string) => void;
  onResolve: (commentId: string, isResolved: boolean) => void;
  onReply: (parentId: string, text: string) => void;
  isSubmitting: boolean;
  depth?: number;
}

export function Comment({
  comment,
  onDelete,
  onResolve,
  onReply,
  isSubmitting,
  depth = 0,
}: CommentProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleSubmitReply = () => {
    if (!trim(replyText)) {
      return;
    }
    onReply(comment.id, replyText);
    setReplyText('');
    setShowReplyForm(false);
  };

  const replies = comment.replies || [];

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-border pl-3' : ''}>
      <div className="p-3 bg-background">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="font-medium text-sm text-foreground">
              {comment.author_username || 'Unknown'}
            </div>
            {comment.is_resolved && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">
                Resolved
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onResolve(comment.id, comment.is_resolved)}
              className="p-1 rounded hover:bg-muted"
              title={comment.is_resolved ? 'Unresolve' : 'Resolve'}
            >
              <CheckCircle
                size={14}
                className={comment.is_resolved ? 'text-green-600' : 'text-muted-foreground'}
              />
            </button>
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="p-1 rounded hover:bg-muted"
              title="Delete"
            >
              <Trash2 size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Text */}
        <div className="text-sm whitespace-pre-wrap text-foreground">
          {comment.text}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-muted-foreground">
            {new Date(comment.created_at).toLocaleString()}
          </div>
          <button
            type="button"
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground"
          >
            <MessageSquare size={12} />
            Reply
          </button>
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <div className="mt-3 pt-3 border-t border-border">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmitReply();
                }
              }}
              placeholder="Write a reply... (Ctrl+Enter to submit)"
              className="w-full px-3 py-2 text-sm border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-muted text-foreground h-[3.75rem]"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyText('');
                }}
                className="px-3 py-1.5 text-sm rounded hover:bg-muted text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReply}
                disabled={!trim(replyText) || isSubmitting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground"
              >
                <Send size={14} />
                {isSubmitting ? 'Posting...' : 'Reply'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nested Replies */}
      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map(reply => (
            <Comment
              key={reply.id}
              comment={reply}
              onDelete={onDelete}
              onResolve={onResolve}
              onReply={onReply}
              isSubmitting={isSubmitting}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
