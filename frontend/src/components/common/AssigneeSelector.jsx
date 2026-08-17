import { useState, useEffect } from "react";
import { Users, Loader2 } from "lucide-react";
import { fetchProjectAssignees } from "../../api/projectShareApi";
import { assignTestCase, unassignTestCase, assignIssue, unassignIssue } from "../../api/assignmentApi";
import useToasts from "../shared/useToasts";

export default function AssigneeSelector({ type, itemId, projectId, currentAssigneeId, onAssigneeChange }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const { showToast } = useToasts();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const mems = await fetchProjectAssignees(projectId);
        setMembers(mems);
      } catch (err) {
        console.error("Failed to load project members", err);
      } finally {
        setLoading(false);
      }
    }
    if (projectId) load();
  }, [projectId]);

  const handleAssign = async (e) => {
    const userId = parseInt(e.target.value, 10);
    setActing(true);
    try {
      if (userId) {
        if (type === "test_case") {
          await assignTestCase(itemId, userId);
        } else {
          await assignIssue(itemId, userId);
        }
        onAssigneeChange(userId);
      } else {
        if (type === "test_case") {
          await unassignTestCase(itemId);
        } else {
          await unassignIssue(itemId);
        }
        onAssigneeChange(null);
      }
    } catch (err) {
      showToast(err.message || "Failed to update assignment");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <Loader2 className="animate-spin text-muted h-4 w-4" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Users size={14} className="text-muted" />
      <select
        value={currentAssigneeId || ""}
        onChange={handleAssign}
        disabled={acting}
        className="text-xs bg-transparent border-none text-ink cursor-pointer focus:outline-none disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {members.map(m => (
          <option key={m.user_id} value={m.user_id}>
            {m.name || m.email || `User ${m.user_id}`}
          </option>
        ))}
      </select>
    </div>
  );
}
