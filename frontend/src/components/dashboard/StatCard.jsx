import React from "react";

export default function StatCard({ title, value, icon: Icon, colorClass = "text-signal", bgClass = "bg-signal-soft" }) {
  return (
    <div className="signal-card p-5 animate-fade-in flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted">{title}</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      </div>
      {Icon && (
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgClass} ${colorClass}`}>
          <Icon size={24} />
        </div>
      )}
    </div>
  );
}