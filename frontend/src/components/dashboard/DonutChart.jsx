import React from "react";
import { PieChart as PieIcon } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import { STATUS_COLORS } from "./chartColors";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";


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

// `compact`: smaller ring with the total in the centre and no built-in legend
// (the caller renders its own legend).
export default function DonutChart({ data, emptyMessage = "No data available", compact = false, centerLabel = "Total" }) {
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
  const total = activeData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className={`relative w-full ${compact ? "h-44" : "h-64"}`}>
      {compact && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-ink">{total}</span>
          <span className="text-[11px] text-muted">{centerLabel}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={activeData}
            cx="50%"
            cy="50%"
            innerRadius={compact ? 58 : 62}
            outerRadius={compact ? 78 : 86}
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
          {!compact && (
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value) => <span className="text-xs font-medium text-ink capitalize ml-1">{value}</span>}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
