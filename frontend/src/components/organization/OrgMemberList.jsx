import { useState } from "react";
import { getAvatarUrl } from "../../utils/avatarUrl";
import { Crown, ShieldCheck, User, ChevronDown, Trash2, Loader2 } from "lucide-react";
import ConfirmDialog from "../shared/ConfirmDialog";

const ROLES = [
  { value: "owner",  label: "Owner",  icon: Crown,        color: "text-ochre" },
  { value: "admin",  label: "Admin",  icon: ShieldCheck,  color: "text-signal" },
  { value: "member", label: "Member", icon: User,          color: "text-muted" },
];

function RoleDropdown({ current, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const meta = ROLES.find((r) => r.value === current) ?? ROLES[2];
  const Icon = meta.icon;

  if (disabled) {
    return (
      <span className={`flex items-center gap-1 text-xs font-semibold ${meta.color}`}>
        <Icon size={12} /> {meta.label}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        id={`role-dropdown-${current}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-hairline bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-signal/40 hover:bg-signal-soft"
      >
        <Icon size={11} className={meta.color} />
        {meta.label}
        <ChevronDown size={10} className="text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-hairline bg-white p-1 shadow-lg">
          {ROLES.map((r) => {
            const R = r.icon;
            return (
              <button
                key={r.value}
                onClick={() => { onChange(r.value); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition hover:bg-paper ${r.value === current ? "bg-signal-soft text-signal" : "text-ink"}`}
              >
                <R size={12} className={r.color} />
                {r.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OrgMemberList({ members, currentUserId, myRole, onRoleChange, onRemove }) {
  const [removing, setRemoving] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { userId, name }
  const canManage = myRole === "owner" || myRole === "admin";

  async function handleRemoveConfirmed() {
    if (!confirmTarget) return;
    setRemoving(confirmTarget.userId);
    try {
      await onRemove(confirmTarget.userId);
    } finally {
      setRemoving(null);
      setConfirmTarget(null);
    }
  }

  if (!members?.length) {
    return <p className="py-6 text-center text-sm text-muted">No members yet.</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-hairline">
        {members.map((m) => {
          const isMe = m.user_id === currentUserId;
          const isOwner = m.role === "owner";
          const canEditThis = canManage && !(isOwner && myRole !== "owner");

          return (
            <li key={m.user_id} className="flex items-center justify-between gap-3 py-3">
              {/* Avatar + info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-signal to-indigo-500 text-xs font-bold text-white overflow-hidden">
                  {m.user?.avatar_url
                    ? <img src={getAvatarUrl(m.user.avatar_url)} alt="" className="h-full w-full object-cover" />
                    : (m.user?.name || "?").charAt(0).toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {m.user?.name || "Unknown"}
                    {isMe && <span className="ml-1.5 text-[10px] text-muted font-normal">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.user?.job_title || m.user?.email}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                <RoleDropdown
                  current={m.role}
                  disabled={!canEditThis || isMe}
                  onChange={(role) => onRoleChange(m.user_id, role)}
                />
                {canManage && !isOwner && !isMe && (
                  <button
                    id={`remove-member-${m.user_id}`}
                    onClick={() => setConfirmTarget({ userId: m.user_id, name: m.user?.name || m.user?.email || "this member" })}
                    disabled={removing === m.user_id}
                    className="rounded-lg p-1.5 text-muted transition hover:bg-flagged-soft hover:text-flagged disabled:opacity-50"
                    title="Remove member"
                  >
                    {removing === m.user_id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Remove member?"
        message={`Are you sure you want to remove ${confirmTarget?.name} from this organization? They will lose access immediately.`}
        confirmText="Remove"
        loading={removing !== null}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
