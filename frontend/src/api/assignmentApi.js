import api from "../services/api";

export const assignTestCase = async (tcId, assigneeId) => {
  const res = await api.put(`/api/test-cases/${tcId}/assign`, { assignee_id: assigneeId });
  return res.data;
};

export const unassignTestCase = async (tcId) => {
  const res = await api.put(`/api/test-cases/${tcId}/unassign`);
  return res.data;
};

export const assignIssue = async (issueId, assigneeId) => {
  const res = await api.put(`/api/issues/${issueId}/assign`, { assignee_id: assigneeId });
  return res.data;
};

export const unassignIssue = async (issueId) => {
  const res = await api.put(`/api/issues/${issueId}/unassign`);
  return res.data;
};

export const getMyAssignments = async () => {
  const res = await api.get("/api/me/assignments");
  return res.data;
};
