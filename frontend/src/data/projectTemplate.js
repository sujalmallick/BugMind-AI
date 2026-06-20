export function createProject({
  name,
  description = "",
}) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),

    name,

    description,
    status: "Draft",

    workflow: "",

    observedSteps: "",

    analysis: null,
    analysisMeta: {
  workflowSnapshot: "",
  analyzedAt: null,
},
 testEnvironment: {
    platform: "",
    osVersion: "",
    build: "",
    device: "",
},

    testCases: [],

    issueHistory: [],

    tracker: [],

    createdAt: now,

    updatedAt: now,
  };
}