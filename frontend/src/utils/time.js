export function formatRelativeTime(date) {
  const now = new Date();
  const updated = new Date(date);

  const diff = Math.floor((now - updated) / 1000);

  if (diff < 60) {
    return "just now";
  }

  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins} min${mins > 1 ? "s" : ""} ago`;
  }

  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  if (diff < 172800) {
    return "yesterday";
  }

  return updated.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}