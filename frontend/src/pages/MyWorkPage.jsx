import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Briefcase, ListChecks, Bug, ArrowRight } from "lucide-react";
import { getMyAssignments } from "../api/assignmentApi";
import ProjectsHeader from "../components/projects/ProjectsHeader";
import AppFooter from "../components/layout/AppFooter";
import ActivityFeed from "../components/shared/ActivityFeed";
import { getMyActivity } from "../services/activityApi";

export default function MyWorkPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ test_cases: [], issues: [] });
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const res = await getMyAssignments();
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <ProjectsHeader />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-signal" size={28} />
        </main>
        <AppFooter />
      </div>
    );
  }

  const { test_cases, issues } = data;

  return (
    <div className="flex min-h-screen flex-col bg-surface font-sans">
      <ProjectsHeader />
      
      <main className="flex-1">
        <header className="border-b border-hairline bg-white px-8 py-5 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Briefcase size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">My Work</h1>
            <p className="text-sm text-muted">Tasks and bugs assigned to you across all projects.</p>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-8">
          
          <section>
            <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-2">
              <Bug size={18} className="text-flagged" />
              <h2 className="text-lg font-bold text-ink">Assigned Bugs ({issues.length})</h2>
            </div>
            {issues.length === 0 ? (
              <p className="text-sm text-muted bg-white p-4 rounded-xl border border-dashed border-hairline text-center">
                No bugs assigned to you.
              </p>
            ) : (
              <div className="grid gap-4">
                {issues.map(issue => (
                  <div key={issue.id} className="bg-white border border-hairline rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition cursor-pointer"
                       onClick={() => navigate(`/project/${issue.project.id}/workspace`)}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold text-flagged bg-flagged-soft px-2 py-0.5 rounded">
                          {issue.bug_id}
                        </span>
                        <span className="text-xs text-muted border border-hairline px-2 py-0.5 rounded capitalize">
                          {issue.status}
                        </span>
                      </div>
                      <h3 className="font-semibold text-ink">{issue.title}</h3>
                      <p className="text-xs text-muted mt-1">Project: <span className="font-medium text-ink">{issue.project.name}</span></p>
                    </div>
                    <ArrowRight size={16} className="text-muted" />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-2">
              <ListChecks size={18} className="text-blue-500" />
              <h2 className="text-lg font-bold text-ink">Assigned Test Cases ({test_cases.length})</h2>
            </div>
            {test_cases.length === 0 ? (
              <p className="text-sm text-muted bg-white p-4 rounded-xl border border-dashed border-hairline text-center">
                No test cases assigned to you.
              </p>
            ) : (
              <div className="grid gap-4">
                {test_cases.map(tc => (
                  <div key={tc.id} className="bg-white border border-hairline rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition cursor-pointer"
                       onClick={() => navigate(`/project/${tc.project.id}/workspace`)}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {tc.test_case_id}
                        </span>
                        <span className="text-xs text-muted border border-hairline px-2 py-0.5 rounded capitalize">
                          {tc.status}
                        </span>
                      </div>
                      <h3 className="font-semibold text-ink line-clamp-1">{tc.description}</h3>
                      <p className="text-xs text-muted mt-1">Project: <span className="font-medium text-ink">{tc.project.name}</span></p>
                    </div>
                    <ArrowRight size={16} className="text-muted" />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-2">
              <Briefcase size={18} className="text-indigo-500" />
              <h2 className="text-lg font-bold text-ink">My Recent Activity</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-hairline shadow-sm">
              <ActivityFeed fetchFn={getMyActivity} />
            </div>
          </section>

        </div>
      </main>
      
      <AppFooter />
    </div>
  );
}
