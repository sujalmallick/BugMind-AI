import { Users, Crown, User } from "lucide-react";

const ROLE_META = {
  team_lead: { label: "Lead",   color: "bg-ochre-soft text-ochre border-ochre/30", icon: Crown },
  member:    { label: "Member", color: "bg-paper text-muted border-hairline",       icon: User },
};

export default function TeamCard({ team, onClick }) {
  const meta = team.my_role ? (ROLE_META[team.my_role] ?? ROLE_META.member) : null;
  const Icon = meta?.icon ?? User;

  return (
    <button
      id={`team-card-${team.id}`}
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-hairline bg-surface p-4 shadow-sm
                 transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/40
                 hover:shadow-md active:translate-y-0"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                          bg-verified-soft text-verified">
            <Users size={14} />
          </div>
          <p className="truncate text-sm font-semibold text-ink group-hover:text-signal transition-colors">
            {team.name}
          </p>
        </div>

        {meta && (
          <span className={`shrink-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
            <Icon size={9} />
            {meta.label}
          </span>
        )}
      </div>

      {team.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted leading-relaxed pl-10">
          {team.description}
        </p>
      )}

      <div className="mt-3 pl-10 text-xs text-muted flex items-center gap-1">
        <Users size={11} />
        {team.member_count} {team.member_count === 1 ? "member" : "members"}
      </div>
    </button>
  );
}
