import React from "react";
import { 
  ListPlus, 
  Pencil, 
  Trash2, 
  UserPlus, 
  UserMinus, 
  RefreshCw, 
  Bug, 
  UserCheck, 
  UserX, 
  Shield, 
  MailCheck, 
  Mail, 
  FolderPlus, 
  FolderEdit,
  Activity
} from "lucide-react";

const VERB_META = {
  created_test_case: { icon: ListPlus, color: "text-blue-500 bg-blue-500/10 border-blue-500/20", label: "created test case" },
  updated_test_case: { icon: Pencil, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20", label: "updated test case" },
  deleted_test_case: { icon: Trash2, color: "text-red-500 bg-red-500/10 border-red-500/20", label: "deleted test case" },
  assigned_test_case: { icon: UserPlus, color: "text-violet-500 bg-violet-500/10 border-violet-500/20", label: "assigned test case" },
  unassigned_test_case: { icon: UserMinus, color: "text-slate-500 bg-slate-500/10 border-slate-500/20", label: "unassigned test case" },
  changed_test_case_status: { icon: RefreshCw, color: "text-teal-500 bg-teal-500/10 border-teal-500/20", label: "updated status" },
  created_issue: { icon: Bug, color: "text-red-500 bg-red-500/10 border-red-500/20", label: "logged issue" },
  assigned_issue: { icon: UserPlus, color: "text-violet-500 bg-violet-500/10 border-violet-500/20", label: "assigned issue" },
  unassigned_issue: { icon: UserMinus, color: "text-slate-500 bg-slate-500/10 border-slate-500/20", label: "unassigned issue" },
  changed_issue_status: { icon: RefreshCw, color: "text-teal-500 bg-teal-500/10 border-teal-500/20", label: "updated issue status" },
  member_joined: { icon: UserCheck, color: "text-green-500 bg-green-500/10 border-green-500/20", label: "joined" },
  member_left: { icon: UserX, color: "text-red-500 bg-red-500/10 border-red-500/20", label: "left" },
  changed_member_role: { icon: Shield, color: "text-amber-500 bg-amber-500/10 border-amber-500/20", label: "role changed" },
  accepted_invitation: { icon: MailCheck, color: "text-green-500 bg-green-500/10 border-green-500/20", label: "accepted invitation" },
  sent_invitation: { icon: Mail, color: "text-blue-500 bg-blue-500/10 border-blue-500/20", label: "sent invitation" },
  created_project: { icon: FolderPlus, color: "text-blue-500 bg-blue-500/10 border-blue-500/20", label: "created project" },
  updated_project: { icon: FolderEdit, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20", label: "updated project" },
};

function formatTimeAgo(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

export default function ActivityItem({ activity }) {
  const meta = VERB_META[activity.verb] || { icon: Activity, color: "text-slate-500 bg-slate-500/10 border-slate-500/20", label: activity.verb };
  const IconComponent = meta.icon;

  const actorName = activity.actor?.name || "System";
  const entityLabel = activity.entity_label || `#${activity.entity_id}`;

  // Build helper detail message if assignee is present in meta
  let actionDetail = null;
  if (activity.meta?.assignee_name) {
    actionDetail = (
      <span className="text-muted text-xs block mt-0.5">
        Assigned to: <strong className="text-ink font-semibold">{activity.meta.assignee_name}</strong>
      </span>
    );
  }

  return (
    <div className="flex gap-4 p-4 border border-hairline bg-surface rounded-xl hover:bg-paper/50 transition">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.color}`}>
        <IconComponent size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted">
          <strong className="text-ink font-semibold">{actorName}</strong>{" "}
          <span className="text-muted/80">{meta.label}</span>{" "}
          <strong className="text-ink font-semibold">{entityLabel}</strong>
        </div>
        {actionDetail}
        <div className="text-xs text-muted/60 mt-1">
          {formatTimeAgo(activity.created_at)}
        </div>
      </div>
    </div>
  );
}
