// Formatting for automation numbers (dashboard, runs).

export function percent(value) {
  return value == null ? 'No result' : `${Math.round(value * 100)}%`
}

// The API sends naive UTC timestamps.
export function formatDate(iso, options = { month: 'short', day: 'numeric' }) {
  if (!iso) return ''
  return new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleDateString(undefined, options)
}
