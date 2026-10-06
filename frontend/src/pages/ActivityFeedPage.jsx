import React, { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { getProjectActivity } from "../services/activityApi";
import ActivityFeed from "../components/shared/ActivityFeed";
import PageHeading from "../components/shared/PageHeading";
import HeaderBar from "../components/layout/HeaderBar";
import AppFooter from "../components/layout/AppFooter";

export default function ActivityFeedPage() {
  const { projectId } = useParams();

  const fetchProjectActivity = useCallback(
    (page, limit) => getProjectActivity(projectId, page, limit),
    [projectId]
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <HeaderBar />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        {projectId && (
          <Link
            to={`/project/${projectId}/workspace`}
            className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            <span aria-hidden="true">←</span> Back to project
          </Link>
        )}
        <PageHeading meta="A full history of all updates and edits within this project.">
          Project activity log
        </PageHeading>
        <ActivityFeed fetchFn={fetchProjectActivity} />
      </main>
      <AppFooter />
    </div>
  );
}
