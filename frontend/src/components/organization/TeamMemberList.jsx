import { useState } from "react";
import { Crown, User, Trash2, Loader2 } from "lucide-react";
import ConfirmDialog from "../shared/ConfirmDialog";
import { getAvatarUrl } from "../../utils/avatarUrl";

const ROLE_META = {
  team_lead: { label: "Lead",   color: "bg-ochre-soft text-ochre border-ochre/30",  icon: Crown },
  member:    { label: "Member", color: "bg-paper text-muted border-hairline",        icon: User },
};

export default function TeamMemberList({ members, currentUserId, canManage, onRemove }) {
  const [removing, setRemoving] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { userId, name }

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
    return <p className="py-4 text-center text-xs text-muted">No team members yet.</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-hairline">
        {members.map((m) => {
          const meta = ROLE_META[m.role] ?? ROLE_META.member;
          const Icon = meta.icon;
          const isMe = m.user_id === currentUserId;

          return (
            <li key={m.user_id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                                bg-gradient-to-br from-signal to-indigo-500 text-[11px] font-bold text-white overflow-hidden">
                  {m.user?.avatar_url
                    ? <img src={getAvatarUrl(m.user.avatar_url)} alt="" className="h-full w-full object-cover" />
                    : (m.user?.name || "?").charAt(0).toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">
                    {m.user?.name || "Unknown"}
                    {isMe && <span className="ml-1 text-[10px] text-muted">(you)</span>}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                  <Icon size={9} />
                  {meta.label}
                </span>

                {canManage && !isMe && (
                  <button
                    id={`remove-team-member-${m.user_id}`}
                    onClick={() => setConfirmTarget({ userId: m.user_id, name: m.user?.name || m.user?.email || "this member" })}
                    disabled={removing === m.user_id}
                    className="rounded-md p-1 text-muted transition hover:bg-flagged-soft hover:text-flagged disabled:opacity-50"
                    title="Remove from team"
                  >
                    {removing === m.user_id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Trash2 size={12} />
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
        title="Remove from team?"
        message={`Are you sure you want to remove ${confirmTarget?.name} from this team?`}
        confirmText="Remove"
        loading={removing !== null}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
