import React from "react";

export default function AssigneeLoadBar({ testCasesCount, issuesCount, totalOpenItems }) {
  const total = testCasesCount + issuesCount;
  
  if (total === 0) {
    return (
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-paper"></div>
    );
  }

  // Calculate percentages based on the user's own total (relative breakdown)
  const tcPercent = (testCasesCount / total) * 100;
  const issuePercent = (issuesCount / total) * 100;

  // We could also scale the overall width based on their total compared to the team's max load,
  // but a full-width bar showing the ratio is cleaner for a small component.
  
  return (
    <div className="group relative">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-paper">
        <div 
          className="bg-signal transition-all duration-500" 
          style={{ width: `${tcPercent}%` }}
        ></div>
        <div 
          className="bg-flagged transition-all duration-500" 
          style={{ width: `${issuePercent}%` }}
        ></div>
      </div>
      
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 z-10 w-max">
        <div className="rounded border border-hairline bg-surface px-2 py-1 text-[10px] font-medium text-ink shadow-sm flex items-center gap-2">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-signal"></div>
            {testCasesCount} TCs
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-flagged"></div>
            {issuesCount} Bugs
          </span>
        </div>
      </div>
    </div>
  );
}
