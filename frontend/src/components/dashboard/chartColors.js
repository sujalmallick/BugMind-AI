// Chart colours, taken from the palette tokens in index.css.
export const STATUS_COLORS = {
  "pass": "#059669",          // verified
  "fail": "#dc2626",          // flagged
  "not-executed": "#94a3b8",  // muted
  "blocked": "#d97706",       // ochre
  "skipped": "#cbd5e1",       // hairline-strong
};

// High sits between flagged and ochre.
export const SEVERITY_COLORS = {
  "critical": "#dc2626",      // flagged
  "high": "#ea580c",
  "medium": "#d97706",        // ochre
  "low": "#94a3b8",           // muted
};
