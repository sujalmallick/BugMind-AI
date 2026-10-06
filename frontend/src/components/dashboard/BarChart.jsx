import React from "react";
import { BarChart3 } from "lucide-react";
import EmptyState from "../shared/EmptyState";
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

// Palette tokens from index.css (high sits between flagged and ochre)
const SEVERITY_COLORS = {
  "critical": "#dc2626",      // flagged
  "high": "#ea580c",
  "medium": "#d97706",        // ochre
  "low": "#94a3b8",           // muted
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass glass-menu rounded-lg px-3 py-2">
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
      <EmptyState
        className="h-full min-h-[220px]"
        icon={<BarChart3 size={18} />}
        title={emptyMessage}
        description="Open bugs assigned to you show up here by severity."
      />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#eef1f5" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          />
          <YAxis 
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9", opacity: 0.8 }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={SEVERITY_COLORS[entry.key] || "#2563eb"} 
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
