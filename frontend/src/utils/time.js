const UTC_NAIVE_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

export function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (typeof value === "string") {
    // FastAPI may return UTC timestamps without timezone info.
    const normalized =
      UTC_NAIVE_TIMESTAMP_REGEX.test(value)
        ? `${value}Z`
        : value;

    const parsed = new Date(normalized);

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

export function formatRelativeTime(date) {
  const updated = parseTimestamp(date);

  if (!updated) {
    return "unknown";
  }

  const diff = Math.max(
    0,
    Math.floor((Date.now() - updated.getTime()) / 1000)
  );

  if (diff < 60) return "just now";

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