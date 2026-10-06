import Pill from "./Pill";

const STATUS_ORDER = [
  "not-executed",
  "pass",
  "fail",
  "blocked",
  "skipped",
];

const STATUS_CONFIG = {
  "not-executed": {
    label: "Not Executed",
    tone: "neutral",
  },
  pass: {
    label: "Passed",
    tone: "verified",
  },
  fail: {
    label: "Failed",
    tone: "flagged",
  },
  blocked: {
    label: "Blocked",
    tone: "neutral",
  },
  skipped: {
    label: "Skipped",
    tone: "ochre",
  },
};

// Some rows (spreadsheet imports, older test plan cases) store the display form
// ("Passed", "Not Executed"); read both as the canonical key.
const STATUS_ALIASES = {
  "not executed": "not-executed",
  passed: "pass",
  failed: "fail",
};

function canonicalStatus(status) {
  const value = String(status || "not-executed").trim().toLowerCase();
  return STATUS_ALIASES[value] ?? value;
}

export default function StatusPill({
  status = "not-executed",
  onChange,
}) {
  const key = canonicalStatus(status);
  const config =
    STATUS_CONFIG[key] ??
    STATUS_CONFIG["not-executed"];

  function handleClick() {
    if (!onChange) return;

    const currentIndex =
      STATUS_ORDER.indexOf(key);

    const nextStatus =
      STATUS_ORDER[
        (currentIndex + 1) %
          STATUS_ORDER.length
      ];

    onChange(nextStatus);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Change Status"
      className="
        cursor-pointer
        rounded-md
        transition-all
        duration-200
        hover:scale-105
        hover:shadow-sm
        active:scale-95
        focus:outline-none
      "
    >
      <Pill tone={config.tone}>
        {config.label}
      </Pill>
    </button>
  );
}

const PRIORITY_CONFIG = {
  high: {
    label: "High",
    tone: "flagged",
  },
  medium: {
    label: "Medium",
    tone: "ochre",
  },
  low: {
    label: "Low",
    tone: "neutral",
  },
};

export function PriorityPill({
  priority = "medium",
}) {
  const config =
    PRIORITY_CONFIG[priority] ??
    PRIORITY_CONFIG.medium;

  return (
    <Pill tone={config.tone}>
      {config.label}
    </Pill>
  );
}

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    tone: "flagged",
  },
  high: {
    label: "High",
    tone: "flagged",
  },
  medium: {
    label: "Medium",
    tone: "ochre",
  },
  low: {
    label: "Low",
    tone: "verified",
  },
};

export function SeverityPill({
  severity = "medium",
}) {
  const config =
    SEVERITY_CONFIG[severity] ??
    SEVERITY_CONFIG.medium;

  return (
    <Pill tone={config.tone}>
      {config.label}
    </Pill>
  );
}