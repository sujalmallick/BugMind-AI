import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CircleCheckBig,
  Clock3,
  FilePenLine,
  FolderKanban,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

import { touchProject } from "../services/projectApi";

import ProjectsHeader from "../components/projects/ProjectsHeader";
import AppFooter from "../components/layout/AppFooter";
import ProjectGrid from "../components/projects/ProjectGrid";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import DeleteProjectModal from "../components/projects/DeleteProjectModal";
import ShareProjectModal from "../components/projects/ShareProjectModal";

import ToastStack from "../components/shared/ToastStack";
import useToasts from "../components/shared/useToasts";
import {
  formatRelativeTime,
  parseTimestamp,
} from "../utils/time";

import { useProjects } from "../hooks/useProjects";
import { createProject } from "../data/projectTemplate";

export default function ProjectsPage() {
  const {
    projects,
    createProject: addProject,
    updateProject,
    deleteProject,
    selectProject,
  } = useProjects();

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [sharingProject, setSharingProject] = useState(null);
  const [sortBy, setSortBy] = useState("updated");
  const [filterBy, setFilterBy] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const { toasts, showToast } = useToasts();

  useEffect(() => {
    if (!location.state?.deleted) return;

    showToast("Project deleted successfully!");

    navigate(location.pathname, {
      replace: true,
      state: {},
    });
  }, [location, navigate, showToast]);

  async function handleCreate(data) {
    const project = createProject(data);

    await addProject(project);

    showToast("Project created successfully!");

    setShowModal(false);
  }

  async function handleRename(data) {
  const updatedProject = {
    ...editingProject,
    name: data.name,
    description: data.description,
    updatedAt: new Date().toISOString(),
  };

  await updateProject(updatedProject);

  showToast("Project renamed successfully!");

  setEditingProject(null);
}

  async function handleDelete(id) {
  await deleteProject(id);

  showToast("Project deleted successfully!");

  setDeletingProject(null);
}

function handleShare(project) {
  setSharingProject(project);
}
async function handleOpen(id) {
  console.log("Clicked id:", id);

  await touchProject(id);

  const project = projects.find(
    (p) => p.id === id
  );

  console.log(project);

  selectProject(id);

  if (project?.analysis) {
    navigate(`/project/${id}/workspace`);
  } else {
    navigate(`/project/${id}`);
  }
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const totalProjects = projects.length;
const analyzedProjects = projects.filter(
  (project) =>
    (project.status || "Draft") ===
    "Analyzed"
).length;
const draftProjects =
  totalProjects - analyzedProjects;
const staleProjects = projects.filter((project) => {
  const updated =
    parseTimestamp(project.updatedAt)?.getTime() || 0;

  return now - updated > 3 * DAY_IN_MS;
}).length;

const filteredProjects = projects.filter((project) => {
  const matchesSearch =
    !searchQuery.trim() ||
    project.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase()) ||
    (project.description || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

  if (!matchesSearch) {
    return false;
  }

  const updated =
    parseTimestamp(project.updatedAt)?.getTime() || 0;

  switch (filterBy) {
    case "draft":
      return (
        (project.status || "Draft") === "Draft"
      );

    case "analyzed":
      return (
        project.status === "Analyzed"
      );

    case "stale":
      return now - updated > 3 * DAY_IN_MS;

    case "active":
      return now - updated <= 3 * DAY_IN_MS;

    default:
      return true;
  }
});

const sortedProjects = [...filteredProjects].sort((a, b) => {
  const bUpdated =
    parseTimestamp(b.updatedAt)?.getTime() || 0;
  const aUpdated =
    parseTimestamp(a.updatedAt)?.getTime() || 0;
  const bCreated =
    parseTimestamp(b.createdAt)?.getTime() || 0;
  const aCreated =
    parseTimestamp(a.createdAt)?.getTime() || 0;

  switch (sortBy) {
    case "updated":
      return bUpdated - aUpdated;

    case "newest":
      return bCreated - aCreated;

    case "oldest":
      return aCreated - bCreated;

    case "az":
      return a.name.localeCompare(b.name);

    case "za":
      return b.name.localeCompare(a.name);

    default:
      return 0;
  }
});

const spotlightProject =
  [...projects]
    .sort((a, b) => {
      const aUpdated =
        parseTimestamp(a.updatedAt)?.getTime() || 0;
      const bUpdated =
        parseTimestamp(b.updatedAt)?.getTime() || 0;

      return bUpdated - aUpdated;
    })[0] || null;

const filterChips = [
  {
    key: "all",
    label: "All",
    count: totalProjects,
  },
  {
    key: "draft",
    label: "Draft",
    count: draftProjects,
  },
  {
    key: "analyzed",
    label: "Analyzed",
    count: analyzedProjects,
  },
  {
    key: "active",
    label: "Active",
    count: totalProjects - staleProjects,
  },
  {
    key: "stale",
    label: "Stale",
    count: staleProjects,
  },
];

  return (
    <>
      <ProjectsHeader
        onCreateProject={() => setShowModal(true)}
      />

      <div className="projects-atmosphere">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
          <section className="hero-glow base-card bg-white/95 p-6 backdrop-blur md:p-8 section-enter section-enter-1">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  <Sparkles size={14} />
                  QA Command Center
                </p>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-shimmer md:text-4xl">
                  Build reliable releases with calmer testing cycles.
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted md:text-base">
                  Manage all BugMind projects from one place, resume the most recent
                  analysis instantly, and focus attention on stale work before it turns
                  into release risk.
                </p>
              </div>

              <div className="flex gap-3 self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="btn-primary"
                >
                  <Plus size={16} />
                  New Project
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="dashboard-stat-card dashboard-stat-total dashboard-stat-enter">
                <p className="dashboard-stat-label">
                  <FolderKanban size={13} className="dashboard-stat-icon" />
                  Total Projects
                </p>
                <p className="dashboard-stat-value">{totalProjects}</p>
                <p className="dashboard-stat-subtext">Across all testing efforts</p>
              </article>

              <article className="dashboard-stat-card dashboard-stat-analyzed dashboard-stat-enter delay-1">
                <p className="dashboard-stat-label">
                  <CircleCheckBig size={13} className="dashboard-stat-icon" />
                  Analyzed
                </p>
                <p className="dashboard-stat-value text-verified">{analyzedProjects}</p>
                <p className="dashboard-stat-subtext">Ready for execution and review</p>
              </article>

              <article className="dashboard-stat-card dashboard-stat-draft dashboard-stat-enter delay-2">
                <p className="dashboard-stat-label">
                  <FilePenLine size={13} className="dashboard-stat-icon" />
                  Draft
                </p>
                <p className="dashboard-stat-value text-ochre">{draftProjects}</p>
                <p className="dashboard-stat-subtext">Need workflow completion</p>
              </article>

              <article className="dashboard-stat-card dashboard-stat-stale dashboard-stat-enter delay-3">
                <p className="dashboard-stat-label">
                  <AlertTriangle size={13} className="dashboard-stat-icon" />
                  Stale
                </p>
                <p className="dashboard-stat-value text-flagged">{staleProjects}</p>
                <p className="dashboard-stat-subtext">No updates in 3+ days</p>
              </article>
            </div>
          </section>

          {spotlightProject && (
            <section className="mt-6 base-card bg-linear-to-r from-white via-sky-50 to-emerald-50 p-5 section-enter section-enter-2">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Spotlight Project
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-ink">
                    {spotlightProject.name}
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    Updated {formatRelativeTime(spotlightProject.updatedAt)} •
                    Status {spotlightProject.status || "Draft"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted shadow-sm">
                    <FolderKanban size={13} />
                    {spotlightProject.moduleCount ?? 0} Modules
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted shadow-sm">
                    <CircleCheckBig size={13} />
                    {spotlightProject.testCaseCount ?? 0} Test Cases
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpen(spotlightProject.id)}
                    className="btn-secondary px-4 py-2 text-sm md:ml-2"
                  >
                    Resume
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="mt-6 base-card p-4 md:p-5 section-enter section-enter-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />

                <input
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.target.value)
                  }
                  placeholder="Search by project name or description"
                  className="w-full rounded-lg border border-hairline bg-paper py-2.5 pl-9 pr-3 text-sm transition focus:border-signal focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Clock3 size={15} className="text-muted" />

                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value)
                  }
                  className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm transition focus:border-signal focus:outline-none"
                >
                  <option value="updated">Recently Updated</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {filterChips.map((chip) => {
                const active = filterBy === chip.key;

                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setFilterBy(chip.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-signal bg-signal text-white"
                        : "border-hairline bg-white text-muted hover:border-signal hover:text-ink"
                    }`}
                  >
                    {chip.label} ({chip.count})
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-6 section-enter section-enter-4">
            <ProjectGrid
              projects={sortedProjects}
          onOpenProject={handleOpen}
          onCreateProject={() => setShowModal(true)}
          onRenameProject={setEditingProject}
          onDeleteProject={setDeletingProject}
          onShareProject={handleShare}
        />
          </section>

          <CreateProjectModal
            open={showModal || !!editingProject}
            onClose={() => {
              setShowModal(false);
              setEditingProject(null);
            }}
            onCreate={
              editingProject
                ? handleRename
                : handleCreate
            }
            initialData={editingProject}
            mode={
              editingProject
                ? "edit"
                : "create"
            }
          />

          <DeleteProjectModal
            open={!!deletingProject}
            project={deletingProject}
            onClose={() => setDeletingProject(null)}
            onDelete={handleDelete}
          />

      {sharingProject && (
        <ShareProjectModal
          project={sharingProject}
          onClose={() => setSharingProject(null)}
        />
      )}
    </div>

        <AppFooter />
      </div>

      <ToastStack toasts={toasts} />
    </>
  );
}