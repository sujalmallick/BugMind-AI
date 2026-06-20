import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { projectService } from "../services/projectService";

import ProjectsHeader from "../components/projects/ProjectsHeader";
import ProjectGrid from "../components/projects/ProjectGrid";
import CreateProjectModal from "../components/projects/CreateProjectModal";
import DeleteProjectModal from "../components/projects/DeleteProjectModal";

import ToastStack from "../components/shared/ToastStack";
import useToasts from "../components/shared/useToasts";

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
const [sortBy, setSortBy] = useState("updated");
  const [filterBy, setFilterBy] = useState("all");
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

  function handleCreate(data) {
    const project = createProject(data);

    addProject(project);

    showToast("Project created successfully!");

    setShowModal(false);
  }

  function handleRename(data) {
    const updatedProject = {
      ...editingProject,
      name: data.name,
      description: data.description,
      updatedAt: new Date().toISOString(),
    };

    updateProject(updatedProject);

    showToast("Project renamed successfully!");

    setEditingProject(null);
  }

  function handleDelete(id) {
    deleteProject(id);

    showToast("Project deleted successfully!");

    setDeletingProject(null);
  }
function handleShare(project) {
  const shareUrl = `${window.location.origin}/project/${project.id}`;

  navigator.clipboard
    .writeText(shareUrl)
    .then(() => {
      showToast("Project link copied!");
    })
    .catch(() => {
      showToast("Failed to copy link.");
    });
}
  function handleOpen(id) {
    const project = projectService.getById(id);

    selectProject(id);

    if (project?.analysis) {
      navigate(`/project/${id}/workspace`);
    } else {
      navigate(`/project/${id}`);
    }
  }
const filteredProjects = projects.filter((project) => {
  switch (filterBy) {
    case "draft":
      return (
        (project.status || "Draft") === "Draft"
      );

    case "analyzed":
      return (
        project.status === "Analyzed"
      );

    default:
      return true;
  }
});

const sortedProjects = [...filteredProjects].sort((a, b) => {
  switch (sortBy) {
    case "updated":
      return (
        new Date(b.updatedAt) -
        new Date(a.updatedAt)
      );

    case "newest":
      return (
        new Date(b.createdAt) -
        new Date(a.createdAt)
      );

    case "oldest":
      return (
        new Date(a.createdAt) -
        new Date(b.createdAt)
      );

    case "az":
      return a.name.localeCompare(b.name);

    case "za":
      return b.name.localeCompare(a.name);

    default:
      return 0;
  }
});
  return (
    <>
      <ProjectsHeader
        onCreateProject={() => setShowModal(true)}
      />

      <div className="mx-auto max-w-7xl px-8 py-8">
<div className="mb-8">

  <h1 className="text-3xl font-semibold text-ink">
    Projects
  </h1>

  <div className="mt-3 flex items-center justify-between">

    <p className="text-sm text-muted">
      Manage all your AI testing projects.
    </p>

    <div className="flex items-center gap-3">

      {/* Filter comes next */}
      <select
  value={filterBy}
  onChange={(e) =>
    setFilterBy(e.target.value)
  }
  className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm transition focus:border-signal focus:outline-none"
>
  <option value="all">
    All Projects
  </option>

  <option value="draft">
    Draft
  </option>

  <option value="analyzed">
    Analyzed
  </option>
</select>

      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm transition focus:border-signal focus:outline-none"
      >
        <option value="updated">
          Recently Updated
        </option>

        <option value="newest">
          Newest
        </option>

        <option value="oldest">
          Oldest
        </option>

        <option value="az">
          A → Z
        </option>

        <option value="za">
          Z → A
        </option>

      </select>

    </div>

  </div>

</div>

        <ProjectGrid
       projects={sortedProjects}
          onOpenProject={handleOpen}
          onCreateProject={() => setShowModal(true)}
          onRenameProject={setEditingProject}
          onDeleteProject={setDeletingProject}
          onShareProject={handleShare}
        />

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

      </div>

      <ToastStack toasts={toasts} />
    </>
  );
}