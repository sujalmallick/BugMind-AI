import API_BASE_URL from "./api";

export async function getProjects() {
  const response = await fetch(`${API_BASE_URL}/projects/`);

  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
const data = await response.json();

return data.map((project) => ({
  ...project,
  createdAt: project.created_at,
  updatedAt: project.updated_at,
}));
}

export async function createProject(project) {
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  });

  if (!response.ok) {
    throw new Error("Failed to create project");
  }
const data = await response.json();

return {
  ...data,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
};
}

export async function updateProject(id, project) {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  });

  if (!response.ok) {
    throw new Error("Failed to update project");
  }

  return response.json();
}

export async function deleteProject(id) {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete project");
  }

  return response.json();
}

export async function getProject(id) {
  const response = await fetch(
    `${API_BASE_URL}/projects/${id}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch project");
  }

  const data = await response.json();

  return {
    ...data,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}