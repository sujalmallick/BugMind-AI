import { ArrowUpRight, Crown, ShieldCheck, User, Users, Layers3 } from "lucide-react";

import Pill from "../shared/Pill";

const ROLE_META = {
  owner:  { label: "Owner",  tone: "ochre",   icon: Crown },
  admin:  { label: "Admin",  tone: "signal",  icon: ShieldCheck },
  member: { label: "Member", tone: "neutral", icon: User },
};

export default function OrgCard({ org, onClick }) {
  const meta = ROLE_META[org.my_role] ?? ROLE_META.member;

  return (
    <button
      id={`org-card-${org.id}`}
      onClick={onClick}
      className="glass-card card-glow-hover group flex w-full flex-col p-5 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-signal-soft text-[16px] font-semibold text-signal">
            {org.logo_url
              ? <img src={org.logo_url} alt="" className="h-full w-full object-cover" />
              : org.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{org.name}</p>
            <p className="truncate font-mono text-[12px] text-muted">{org.slug}</p>
          </div>
        </div>
        <Pill tone={meta.tone} icon={meta.icon}>{meta.label}</Pill>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-muted">
        {org.description || "No description yet."}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3.5 text-[12px] text-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Users size={13} aria-hidden="true" />
            {org.member_count} {org.member_count === 1 ? "member" : "members"}
          </span>
          <span className="flex items-center gap-1.5">
            <Layers3 size={13} aria-hidden="true" />
            {org.team_count} {org.team_count === 1 ? "team" : "teams"}
          </span>
        </div>
        <ArrowUpRight size={15} aria-hidden="true" className="text-muted transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>
    </button>
  );
}
