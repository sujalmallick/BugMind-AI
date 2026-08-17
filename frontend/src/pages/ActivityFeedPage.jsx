import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { getProjectActivity } from "../services/activityApi";
import ActivityFeed from "../components/shared/ActivityFeed";

export default function ActivityFeedPage() {
  const { projectId } = useParams();

  const fetchProjectActivity = useCallback(
    (page, limit) => getProjectActivity(projectId, page, limit),
    [projectId]
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Project Activity Log</h1>
        <p className="text-sm text-muted">A full history of all updates and edits within this project.</p>
      </div>
      <ActivityFeed fetchFn={fetchProjectActivity} />
    </div>
  );
}
