import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUS_COLORS = {
  "pass": "#1a7f5a",          // verified
  "fail": "#c4432b",          // flagged
  "not-executed": "#5b6573",  // muted
  "blocked": "#b8860b",       // ochre
  "skipped": "#9ca3af",       // gray
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-hairline bg-surface p-3 shadow-sm">
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
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-hairline bg-paper">
        <p className="text-sm text-muted">{emptyMessage}</p>
      </div>
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
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="count"
            nameKey="label"
          >
            {activeData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={STATUS_COLORS[entry.key] || "#3454d1"} 
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
