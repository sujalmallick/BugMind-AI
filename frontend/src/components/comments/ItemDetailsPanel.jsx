import SlideOverPanel from "../shared/SlideOverPanel";
import CommentThread from "./CommentThread";

export default function ItemDetailsPanel({ 
  isOpen, 
  onClose, 
  item, 
  type, // 'test_case' or 'issue'
  projectId 
}) {
  if (!item) return null;

  // Use db_id (numeric PK) for comments; fall back to id for non-mapped items
  const numericId = item.db_id ?? item.id;
  const title = type === 'test_case' ? `Test Case: ${item.id}` : `Issue: ${item.bug_id}`;

  return (
    <SlideOverPanel isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col h-full bg-white">
        {/* Item Details Header Area */}
        <div className="p-6 border-b border-hairline bg-surface/30">
          <h3 className="text-base font-semibold text-ink mb-2">
            {type === 'test_case' ? item.description : item.title}
          </h3>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-white border border-hairline rounded font-medium capitalize">
              {item.status}
            </span>
            <span className="px-2 py-1 bg-white border border-hairline rounded text-muted">
              {type === 'test_case' ? `Module: ${item.module}` : `Priority: ${item.priority}`}
            </span>
          </div>
        </div>

        {/* Comments Section */}
        <div className="flex-1 overflow-hidden flex flex-col bg-surface/10">
          <div className="px-6 py-3 border-b border-hairline bg-surface/30 sticky top-0 z-10">
            <h4 className="text-sm font-bold text-ink">Discussion</h4>
          </div>
          <CommentThread 
            entityType={type} 
            entityId={numericId} 
            projectId={projectId} 
          />
        </div>
      </div>
    </SlideOverPanel>
  );
}
