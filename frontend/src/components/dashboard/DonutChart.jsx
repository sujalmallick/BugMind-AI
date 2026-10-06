import React from "react";
import { PieChart as PieIcon } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

// Palette tokens from index.css
const STATUS_COLORS = {
  "pass": "#059669",          // verified
  "fail": "#dc2626",          // flagged
  "not-executed": "#94a3b8",  // muted
  "blocked": "#d97706",       // ochre
  "skipped": "#cbd5e1",       // hairline-strong
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass glass-menu rounded-lg px-3 py-2">
        <p className="text-sm font-medium text-ink capitalize">{data.label}</p>
        <p className="text-xs text-muted mt-0.5">
          Count: <span className="font-semibold text-ink">{data.count}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function DonutChart({ data, emptyMessage = "No data available" }) {
  const hasData = data && data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <EmptyState
        className="h-full min-h-[220px]"
        icon={<PieIcon size={18} />}
        title={emptyMessage}
        description="This chart fills in as test cases are assigned and executed."
      />
    );
  }

  // Filter out 0 counts for better visualization
  const activeData = data.filter((d) => d.count > 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={activeData}
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={86}
            paddingAngle={3}
            cornerRadius={4}
            stroke="none"
            dataKey="count"
            nameKey="label"
          >
            {activeData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={STATUS_COLORS[entry.key] || "#2563eb"} 
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-xs font-medium text-ink capitalize ml-1">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
