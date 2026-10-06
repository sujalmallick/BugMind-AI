import React, { useState, useEffect } from "react";
import ActivityItem from "./ActivityItem";
import EmptyState from "./EmptyState";
import { History, Loader2 } from "lucide-react";

export default function ActivityFeed({ fetchFn }) {
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const loadActivities = async (pageNum, replace = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetchFn(pageNum);
      const newItems = response.items || [];
      setActivities((prev) => (replace ? newItems : [...prev, ...newItems]));
      setTotal(response.total || 0);
      setHasMore(activities.length + newItems.length < (response.total || 0));
    } catch (err) {
      console.error("Failed to fetch activity logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadActivities(1, true);
  }, [fetchFn]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadActivities(nextPage, false);
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted">
        <Loader2 className="animate-spin mb-2" size={24} />
        <span className="text-sm">Loading activity…</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<History size={18} />}
        title="No activity yet"
        description="Edits, assignments and status changes in this project will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-2">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="btn-secondary"
          >
            {loading && <Loader2 className="spin" size={14} aria-hidden="true" />}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
