const STORAGE_KEY = "bugmind-projects";

export const projectService = {
  getAll() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  getById(id) {
    return this.getAll().find((project) => project.id === id);
  },

  create(project) {
    const projects = this.getAll();

    projects.unshift(project);

    this.saveAll(projects);

    return project;
  },

  update(id, updatedProject) {
    const projects = this.getAll().map((project) =>
      project.id === id
        ? {
            ...updatedProject,
            updatedAt: new Date().toISOString(),
          }
        : project
    );

    this.saveAll(projects);
  },

  delete(id) {
    const projects = this.getAll().filter(
      (project) => project.id !== id
    );

    this.saveAll(projects);
  },

  saveAll(projects) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(projects)
    );
  },
};