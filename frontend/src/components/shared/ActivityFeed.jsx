import React, { useState, useEffect } from "react";
import ActivityItem from "./ActivityItem";
import { Loader2 } from "lucide-react";

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
        <span>Loading activities...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-hairline border-dashed rounded-2xl bg-surface/50 text-muted">
        <span className="text-sm">No activity recorded yet.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-hairline bg-surface hover:bg-paper text-sm font-semibold rounded-lg text-ink transition disabled:opacity-50"
          >
            {loading && <Loader2 className="animate-spin" size={14} />}
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
