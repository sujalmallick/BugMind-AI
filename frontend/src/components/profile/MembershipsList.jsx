import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, Crown, ShieldCheck, User, Plus } from "lucide-react";

const ROLE_META = {
  owner:  { label: "Owner",  color: "bg-ochre-soft text-ochre border-ochre/30",   icon: Crown },
  admin:  { label: "Admin",  color: "bg-signal-soft text-signal border-signal/30", icon: ShieldCheck },
  member: { label: "Member", color: "bg-paper text-muted border-hairline",          icon: User },
};

/**
 * MembershipsList — shows org/team memberships from GET /api/me.
 *
 * The backend returns:
 *   { "enabled": true, "items": [{ org, org_id, org_slug, role }] }
 *
 * Props:
 *   memberships  { enabled: boolean, items: [...] }
 */
export default function MembershipsList({ memberships }) {
  const navigate = useNavigate();
  const { enabled, items = [] } = memberships ?? { enabled: false, items: [] };

  return (
    <section className="signal-card p-6 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink mb-1">Organizations &amp; Teams</h2>
          <p className="text-sm text-muted">
            Your workspace access across organizations and teams.
          </p>
        </div>
        <button
          id="go-to-orgs-btn"
          onClick={() => navigate("/organizations")}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-signal px-3 py-2 text-xs
                     font-semibold text-white shadow-sm transition hover:bg-signal/90 hover:-translate-y-0.5"
        >
          <Plus size={12} />
          Manage
        </button>
      </div>

      {!enabled ? (
        /* ── Coming Soon placeholder (should never show now) ─────────── */
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline py-10 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-signal-soft text-signal">
            <Building2 size={22} />
          </div>
          <p className="text-sm font-semibold text-ink">Loading memberships…</p>
        </div>
      ) : items.length === 0 ? (
        /* ── No orgs yet ──────────────────────────────────────────────── */
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline py-10 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-signal-soft text-signal">
            <Building2 size={22} />
          </div>
          <p className="text-sm font-semibold text-ink">No organizations yet</p>
          <p className="max-w-xs text-xs text-muted leading-relaxed">
            Create or join an organization to collaborate with your QA team.
          </p>
          <button
            onClick={() => navigate("/organizations")}
            className="flex items-center gap-1.5 rounded-lg bg-signal px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-signal/90"
          >
            <Plus size={12} /> Create organization
          </button>
        </div>
      ) : (
        /* ── Org list ─────────────────────────────────────────────────── */
        <ul className="flex flex-col gap-2">
          {items.map((m, i) => {
            const meta = ROLE_META[m.role] ?? ROLE_META.member;
            const Icon = meta.icon;
            return (
              <li key={i}>
                <button
                  id={`org-membership-${m.org_id}`}
                  onClick={() => navigate("/organizations")}
                  className="flex w-full items-center justify-between rounded-lg border border-hairline
                             bg-surface px-4 py-3 text-left transition hover:border-signal/30 hover:bg-signal-soft/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                                    bg-gradient-to-br from-signal to-indigo-500 text-white text-sm font-bold">
                      {m.org.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{m.org}</p>
                      <p className="text-xs text-muted font-mono">{m.org_slug}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                      <Icon size={9} />
                      {meta.label}
                    </span>
                    <ChevronRight size={14} className="text-muted" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
