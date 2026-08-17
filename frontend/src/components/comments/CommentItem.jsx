import { formatRelativeTime } from "../../utils/time";
import { Smile } from "lucide-react";

export default function CommentItem({ comment }) {
  const { author, body, created_at, reactions = [] } = comment;

  // Extremely basic markdown/mention formatting for display
  // In a real app, use react-markdown and parse @mentions properly
  const formattedBody = body.split(/(@[a-zA-Z0-9_.-]+)/).map((part, i) => {
    if (part.startsWith("@")) {
      return <span key={i} className="text-blue-600 font-medium bg-blue-50 px-1 rounded">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });

  return (
    <div className="flex gap-3 mb-6">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
        {author?.name?.charAt(0) || "?"}
      </div>

      <div className="flex-1">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-sm text-ink">{author?.name}</span>
          <span className="text-xs text-muted">
            {formatRelativeTime(created_at)}
          </span>
        </div>

        {/* Body */}
        <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
          {formattedBody}
        </div>

        {/* Actions / Reactions (stubbed for UI) */}
        <div className="flex items-center gap-2 mt-2">
          <button className="text-xs text-muted hover:text-ink flex items-center gap-1 font-medium transition-colors">
            <Smile size={14} /> React
          </button>
          {reactions.length > 0 && (
            <div className="flex items-center gap-1">
              {/* Show grouped reactions here */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
