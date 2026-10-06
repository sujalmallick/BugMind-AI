import api from "../api/api";

// ---------- AI ----------

export async function analyzeWorkflow(payload) {
  if (!payload.workflow.trim()) {
    throw new Error("Describe the workflow first.");
  }

  const body = {
    workflow: payload.workflow,
    observed_steps: payload.observedSteps
      .split("\n")
      .filter((step) => step.trim() !== ""),
  };

  // Optional: lets the agents avoid duplicating the project's manual test cases.
  if (payload.projectId) {
    body.project_id = payload.projectId;
  }
  // Optional target environment (platform / OS / build / device) for the AI.
  if (payload.environment) {
    body.environment = payload.environment;
  }
  if (payload.existingChecklist) {
    body.existing_checklist = payload.existingChecklist;
  }
  if (payload.existingTestCases) {
    body.existing_test_cases = payload.existingTestCases;
  }

  const response = await api.post(
    "/analyze-workflow",
    body
  );

  return response.data;
}

export async function classifyIssue(payload) {
  const response = await api.post(
    "/analyze-issue",
    {
      workflow: payload.workflow,
      observation: payload.observation,
      expected_result: payload.expected,
      actual_result: payload.actual,
      failed_test_case:
        payload.mode === "failed",
      // Optional project context: duplicate detection + the failing test case's details.
      project_id: payload.projectId ?? null,
      test_case_ref: payload.testCaseRef || null,
    }
  );

  return response.data;
}

// ---------- Analysis CRUD ----------

export async function getAnalysis(projectId) {
  const response = await api.get(
    `/analysis/${projectId}`
  );

  return response.data;
}

export async function saveAnalysis(
  projectId,
  result
) {
  const response = await api.put(
    `/analysis/${projectId}`,
    {
      result,
    }
  );

  return response.data;
}