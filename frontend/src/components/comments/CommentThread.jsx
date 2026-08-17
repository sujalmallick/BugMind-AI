import { useState, useEffect, useCallback } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { getComments, createComment } from "../../services/commentApi";
import CommentItem from "./CommentItem";
import CommentEditor from "./CommentEditor";

export default function CommentThread({ entityType, entityId, projectId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    if (!entityId) return;
    try {
      const data = await getComments(entityType, entityId);
      setComments(data);
    } catch (err) {
      console.error("Failed to fetch comments", err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    setLoading(true);
    fetchComments();
  }, [fetchComments]);

  const handlePostComment = async (text) => {
    try {
      await createComment({
        entity_type: entityType,
        entity_id: entityId,
        body: text,
      });
      fetchComments();
    } catch (err) {
      console.error("Failed to post comment", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="animate-spin text-muted" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="mx-auto text-muted mb-2 opacity-50" size={32} />
            <p className="text-sm text-muted">No comments yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map(c => (
              <CommentItem key={c.id} comment={c} />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-hairline sticky bottom-0">
        <CommentEditor projectId={projectId} onSubmit={handlePostComment} />
      </div>
    </div>
  );
}
