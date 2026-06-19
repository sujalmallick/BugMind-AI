import { useEffect, useState } from "react";
import { projectService } from "../services/projectService";

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);

  useEffect(() => {
    const stored = projectService.getAll();
    setProjects(stored);
  }, []);

  const createProject = (project) => {
    const updated = [project, ...projects];

    setProjects(updated);

    projectService.saveAll(updated);

    setCurrentProject(project);
  };

  const updateProject = (updatedProject) => {
    const updated = projects.map((p) =>
      p.id === updatedProject.id ? updatedProject : p
    );

    setProjects(updated);

    projectService.saveAll(updated);

    setCurrentProject(updatedProject);
  };

  const deleteProject = (id) => {
    const updated = projects.filter((p) => p.id !== id);

    setProjects(updated);

    projectService.saveAll(updated);

    if (currentProject?.id === id) {
      setCurrentProject(null);
    }
  };

  const selectProject = (project) => {
    setCurrentProject(project);
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