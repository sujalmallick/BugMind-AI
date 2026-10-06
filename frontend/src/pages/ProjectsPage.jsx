import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CircleCheckBig,
  FilePenLine,
  FileSpreadsheet,
  FolderKanban,
  Plus,
  Search,
} from "lucide-react";

import { touchProject } from "../services/projectApi";
import PageHeading from "../components/shared/PageHeading";


import ProjectsHeader from "../components/projects/ProjectsHeader";
import AppFooter from "../components/layout/AppFooter";
import ProjectGrid from "../components/projects/ProjectGrid";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import DeleteProjectModal from "../components/projects/DeleteProjectModal";
import ShareProjectModal from "../components/projects/ShareProjectModal";
import ImportCsvModal from "../components/csv/ImportCsvModal";

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
    refreshProjects,
  } = useProjects();

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [sharingProject, setSharingProject] = useState(null);
  const [sortBy, setSortBy] = useState("updated");
  const [filterBy, setFilterBy] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
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
    try {
      const project = createProject(data);
      await addProject(project);
      showToast("Project created successfully!");
      setShowModal(false);
    } catch (err) {
      showToast(err?.response?.data?.detail || err.message || "Failed to create project.");
      setShowModal(false);
    }
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
function handleOpenDashboard(project) {
  navigate(`/project/${project.id}/dashboard`);
}
async function handleOpen(id) {
  console.log("Clicked id:", id);
  await touchProject(id);
  selectProject(id);
  // Always open workspace — the workspace page itself decides what to show
  navigate(`/project/${id}/workspace`);
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
      <ProjectsHeader />

      <div className="projects-atmosphere">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
          <section className="section-enter section-enter-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <PageHeading meta="All your QA projects in one place. Resume work, review coverage, and track what needs attention.">
              Projects
            </PageHeading>

            <div className="flex gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="btn-secondary"
              >
                <FileSpreadsheet size={15} aria-hidden="true" />
                Import CSV
              </button>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                <Plus size={16} aria-hidden="true" />
                New project
              </button>
            </div>
          </section>

          <section className="section-enter section-enter-2 mt-6 grid gap-3 grid-cols-2 xl:grid-cols-4" aria-label="Project summary">
            <article className="dashboard-stat-card dashboard-stat-total">
              <p className="dashboard-stat-label">
                <FolderKanban size={13} className="dashboard-stat-icon" aria-hidden="true" />
                Total projects
              </p>
              <p className="dashboard-stat-value">{totalProjects}</p>
              <p className="dashboard-stat-subtext">All testing projects</p>
            </article>

            <article className="dashboard-stat-card dashboard-stat-analyzed">
              <p className="dashboard-stat-label">
                <CircleCheckBig size={13} className="dashboard-stat-icon" aria-hidden="true" />
                Analyzed
              </p>
              <p className="dashboard-stat-value">{analyzedProjects}</p>
              <p className="dashboard-stat-subtext">Ready to execute</p>
            </article>

            <article className="dashboard-stat-card dashboard-stat-draft">
              <p className="dashboard-stat-label">
                <FilePenLine size={13} className="dashboard-stat-icon" aria-hidden="true" />
                Draft
              </p>
              <p className="dashboard-stat-value">{draftProjects}</p>
              <p className="dashboard-stat-subtext">Incomplete workflow</p>
            </article>

            <article className="dashboard-stat-card dashboard-stat-stale">
              <p className="dashboard-stat-label">
                <AlertTriangle size={13} className="dashboard-stat-icon" aria-hidden="true" />
                Stale
              </p>
              <p className="dashboard-stat-value">{staleProjects}</p>
              <p className="dashboard-stat-subtext">Inactive 3+ days</p>
            </article>
          </section>

          {spotlightProject && (
            <section className="section-enter section-enter-3 mt-6 base-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="eyebrow">Continue where you left off</p>
                <h2 className="mt-1.5 truncate text-lg font-semibold tracking-[-0.01em] text-ink">
                  {spotlightProject.name}
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  Updated {formatRelativeTime(spotlightProject.updatedAt)} · {spotlightProject.status || "Draft"}
                  {" · "}{spotlightProject.moduleCount ?? 0} modules · {spotlightProject.testCaseCount ?? 0} test cases
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpen(spotlightProject.id)}
                className="btn-secondary shrink-0 self-start md:self-auto"
              >
                Resume
              </button>
            </section>
          )}

          <section className="section-enter section-enter-3 mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="tablist"
              aria-label="Filter projects"
              className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1"
            >
              {filterChips.map((chip) => {
                const active = filterBy === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilterBy(chip.key)}
                    className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      active ? "bg-ink/[0.06] text-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
                    }`}
                  >
                    {chip.label}
                    <span className="ml-1.5 font-mono text-[11px] text-muted">{chip.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  aria-label="Search projects"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search projects"
                  className="field !pl-9"
                />
              </div>

              <label className="sr-only" htmlFor="project-sort">Sort projects</label>
              <select
                id="project-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="field !w-auto"
              >
                <option value="updated">Recently updated</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
              </select>
            </div>
          </section>

          <section className="mt-4 section-enter section-enter-4">
            <ProjectGrid
              projects={sortedProjects}
          onOpenProject={handleOpen}
          onDashboardProject={handleOpenDashboard}
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

      <ImportCsvModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        showToast={showToast}
        onImported={async () => {
          await refreshProjects();
        }}
      />
    </>
  );
}