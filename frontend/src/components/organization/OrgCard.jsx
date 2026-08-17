import { Building2, Users, Crown, ShieldCheck, User } from "lucide-react";

const ROLE_META = {
  owner:  { label: "Owner",  color: "bg-ochre-soft text-ochre border-ochre/30",    icon: Crown },
  admin:  { label: "Admin",  color: "bg-signal-soft text-signal border-signal/30",  icon: ShieldCheck },
  member: { label: "Member", color: "bg-paper text-muted border-hairline",           icon: User },
};

export default function OrgCard({ org, onClick }) {
  const meta = ROLE_META[org.my_role] ?? ROLE_META.member;
  const RoleIcon = meta.icon;

  return (
    <button
      id={`org-card-${org.id}`}
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-hairline bg-surface p-5 shadow-sm
                 transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/40
                 hover:shadow-md active:translate-y-0 focus-visible:outline-none"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Logo or initial */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                          bg-gradient-to-br from-signal to-indigo-500 text-white shadow-sm">
            {org.logo_url
              ? <img src={org.logo_url} alt={org.name} className="h-full w-full rounded-lg object-cover" />
              : <Building2 size={18} />
            }
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink group-hover:text-signal transition-colors">
              {org.name}
            </p>
            <p className="text-xs text-muted font-mono">{org.slug}</p>
          </div>
        </div>

        {/* Role badge */}
        <span className={`shrink-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
          <RoleIcon size={9} />
          {meta.label}
        </span>
      </div>

      {/* Description */}
      {org.description && (
        <p className="mt-3 line-clamp-2 text-xs text-muted leading-relaxed">
          {org.description}
        </p>
      )}

      {/* Footer stats */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Users size={12} />
          {org.member_count} {org.member_count === 1 ? "member" : "members"}
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} className="opacity-60" />
          {org.team_count} {org.team_count === 1 ? "team" : "teams"}
        </span>
      </div>
    </button>
  );
}
