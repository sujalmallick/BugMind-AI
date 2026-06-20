import { useEffect, useState } from "react";
import {
  getProjects,
  createProject as createProjectApi,
  updateProject as updateProjectApi,
  deleteProject as deleteProjectApi,
} from "../services/projectApi";

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);

useEffect(() => {
  async function loadProjects() {
    const data = await getProjects();
    setProjects(data);
  }

  loadProjects();
}, []);

  const createProject = async (project) => {
  const savedProject = await createProjectApi({
    name: project.name,
    description: project.description,
  });

  setProjects((prev) => [savedProject, ...prev]);
setCurrentProject({
  ...savedProject,
  createdAt: savedProject.created_at,
  updatedAt: savedProject.updated_at,
});
};

const updateProject = async (updatedProject) => {
  const savedProject =
    await updateProjectApi(
      updatedProject.id,
      {
        name: updatedProject.name,
        description: updatedProject.description,
        status: updatedProject.status || "Draft",
      }
    );

  setProjects((prev) =>
    prev.map((project) =>
      project.id === savedProject.id
        ? {
            ...savedProject,
            createdAt: savedProject.created_at,
            updatedAt: savedProject.updated_at,
          }
        : project
    )
  );

  setCurrentProject(savedProject);
};

const deleteProject = async (id) => {
  await deleteProjectApi(id);

  setProjects((prev) =>
    prev.filter(
      (project) => project.id !== id
    )
  );

  if (currentProject?.id === id) {
    setCurrentProject(null);
  }
};

  const selectProject = (id) => {
    const project = projects.find(
      (p) => p.id === id
    );

    setCurrentProject(project || null);
  };

  return {
    projects,
    currentProject,

    createProject,
    updateProject,
    deleteProject,
    selectProject,
  };
}