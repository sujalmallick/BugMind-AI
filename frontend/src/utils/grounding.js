// Text helpers for the answer-grounding result attached to AI-generated test cases.

export function sourceLabel(source) {
  if (source?.type === "workflow") return "Workflow";
  if (source?.type === "document") return source.heading ? `${source.filename} › ${source.heading}` : source.filename;
  return "";
}

// Plain-text summary (grid tooltip and quick filter). Notes are always included.
export function groundingSummary(grounding) {
  if (!grounding) return "";
  const notes = grounding.notes?.length ? ` · ${grounding.notes.join(" · ")}` : "";
  if (grounding.status === "grounded") {
    return `Grounded in: ${(grounding.sources ?? []).map(sourceLabel).join(", ")}${notes}`;
  }
  return `Assumed (double-check)${notes}`;
}
