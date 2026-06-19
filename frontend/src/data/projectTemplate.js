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
    analysisMeta: {
  workflowSnapshot: "",
  analyzedAt: null,
},

    testCases: [],

    issueHistory: [],

    tracker: [],

    createdAt: now,

    updatedAt: now,
  };
}