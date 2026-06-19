import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ProjectsHeader from "../components/projects/ProjectsHeader";
import ProjectGrid from "../components/projects/ProjectGrid";
import CreateProjectModal from "../components/projects/CreateProjectModal";

import { useProjects } from "../hooks/useProjects";
import { createProject } from "../data/projectTemplate";

export default function ProjectsPage() {
  const {
    projects,
    createProject: addProject,
    selectProject,
  } = useProjects();

  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();

  function handleCreate(data) {
    const project = createProject(data);

    addProject(project);

    setShowModal(false);
  }

  function handleOpen(id) {
    selectProject(id);
    navigate(`/project/${id}`);
  }

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

          <p className="mt-2 text-sm text-muted">
            Manage all your AI testing projects.
          </p>
        </div>

        <ProjectGrid
          projects={projects}
          onOpenProject={handleOpen}
          onCreateProject={() => setShowModal(true)}
        />

        <CreateProjectModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />

      </div>
    </>
  );
}