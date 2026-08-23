import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { getProjectActivity } from "../services/activityApi";
import ActivityFeed from "../components/shared/ActivityFeed";
import PageHeading from "../components/shared/PageHeading";

export default function ActivityFeedPage() {
  const { projectId } = useParams();

  const fetchProjectActivity = useCallback(
    (page, limit) => getProjectActivity(projectId, page, limit),
    [projectId]
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <PageHeading meta="A full history of all updates and edits within this project.">
        Project activity log
      </PageHeading>
      <ActivityFeed fetchFn={fetchProjectActivity} />
    </div>
  );
}
