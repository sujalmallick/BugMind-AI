import api from "./api";

export async function getProjects() {
  const response = await api.get("/projects/");
  const data = response.data;

  return data.map((project) => ({
    ...project,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    moduleCount: project.module_count,
    testCaseCount: project.test_case_count,
  }));
}

export async function createProject(project) {
  const response = await api.post("/projects/", project);
  const data = response.data;

  return {
    ...data,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateProject(id, project) {
  const response = await api.put(`/projects/${id}`, project);
  return response.data;
}

export async function deleteProject(id) {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
}

export async function getProject(id) {
  const response = await api.get(`/projects/${id}`);
  const data = response.data;

  return {
    ...data,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function touchProject(id) {
  const response = await api.put(`/projects/${id}/touch`);
  return response.data;
}