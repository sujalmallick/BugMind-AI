import React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

const SEVERITY_COLORS = {
  "critical": "#c4432b",      // flagged
  "high": "#e65c00",          // custom orange
  "medium": "#b8860b",        // ochre
  "low": "#5b6573",           // muted
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-hairline bg-surface p-3 shadow-sm">
        <p className="text-sm font-medium text-ink capitalize">{data.label}</p>
        <p className="text-xs text-muted mt-0.5">
          Open Bugs: <span className="font-semibold text-ink">{data.count}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function BarChart({ data, emptyMessage = "No open bugs" }) {
  const hasData = data && data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-hairline bg-paper">
        <p className="text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e1" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#5b6573" }}
            tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          />
          <YAxis 
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#5b6573" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#fbe9e5", opacity: 0.4 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={SEVERITY_COLORS[entry.key] || "#3454d1"} 
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
