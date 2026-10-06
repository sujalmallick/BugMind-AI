import { ChevronRight, Crown, User, Users } from "lucide-react";

import Pill from "../shared/Pill";

const ROLE_META = {
  team_lead: { label: "Lead",   tone: "ochre",   icon: Crown },
  member:    { label: "Member", tone: "neutral", icon: User },
};

export default function TeamCard({ team, onClick }) {
  const meta = team.my_role ? (ROLE_META[team.my_role] ?? ROLE_META.member) : null;

  return (
    <button
      id={`team-card-${team.id}`}
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl border border-hairline bg-surface p-4 text-left shadow-[var(--shadow-card)]
                 transition-all duration-200 hover:-translate-y-px hover:border-hairline-strong hover:shadow-[var(--shadow-raised)]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-verified-soft text-verified">
        <Users size={16} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold text-ink">{team.name}</p>
          {meta && <Pill tone={meta.tone} icon={meta.icon}>{meta.label}</Pill>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
          {team.description || "No description"}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
          <Users size={12} aria-hidden="true" />
          {team.member_count} {team.member_count === 1 ? "member" : "members"}
        </p>
      </div>

      <ChevronRight size={16} aria-hidden="true" className="mt-2.5 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
    </button>
  );
}
