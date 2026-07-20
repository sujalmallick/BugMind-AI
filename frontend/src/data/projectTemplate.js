export function createProject({
  name,
  description = "",
  organizationId = null,
  teamId = null,
  importSourceProjectId = null,
}) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),

    name,

    description,
    status: "Draft",
    organizationId,
    teamId,
    importSourceProjectId,

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