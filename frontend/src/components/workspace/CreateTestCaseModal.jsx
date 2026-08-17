import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createManualTestCase } from "../../services/testCaseApi";
import useToasts from "../shared/useToasts";

export default function CreateTestCaseModal({ projectId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToasts();
  const [form, setForm] = useState({
    test_case_id: "MANUAL-GEN",
    description: "",
    module: "General",
    category: "Functional",
    priority: "Medium",
    preconditions: "",
    steps: "",
    expected_result: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description) {
      showToast("Description is required");
      return;
    }
    setLoading(true);
    try {
      const tc = await createManualTestCase(projectId, form);
      showToast("Test case created manually!");
      onSuccess(tc);
      onClose();
    } catch (err) {
      showToast(err.message || "Failed to create test case");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h2 className="text-lg font-bold text-ink">Create Manual Test Case</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-paper hover:text-ink transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink">Test Case ID</label>
              <input
                type="text"
                value={form.test_case_id}
                onChange={(e) => setForm({ ...form, test_case_id: e.target.value })}
                className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink">Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={2}
                className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-signal focus:outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Module</label>
                <input
                  type="text"
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                  className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-signal focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-signal focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-signal focus:outline-none"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink">Steps</label>
              <textarea
                value={form.steps}
                onChange={(e) => setForm({ ...form, steps: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-signal focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-muted hover:bg-paper transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-signal px-5 py-2 text-sm font-bold text-white hover:bg-signal/90 transition shadow-md shadow-signal/20 disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Create Test Case
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
