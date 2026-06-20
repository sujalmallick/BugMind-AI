import { useEffect, useState } from "react";
import {
  getWorkspace,
  updateWorkspace,
} from "../services/workspaceApi";

export function useWorkspace(projectId) {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getWorkspace(projectId);
        setWorkspace(data);
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      load();
    }
  }, [projectId]);

async function save(data) {
  await updateWorkspace(
    projectId,
    data
  );
}
  return {
    workspace,
    loading,
    save,
  };
}