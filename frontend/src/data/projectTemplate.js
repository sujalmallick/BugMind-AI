export function createProject({
  name,
  description = "",
}) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),

    name,

    description,

    workflow: "",

    observedSteps: "",

    analysis: null,

    testCases: [],

    issueHistory: [],

    tracker: [],

    createdAt: now,

    updatedAt: now,
  };
}