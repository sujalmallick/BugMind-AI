import api from "../services/api";

/** Create a new invitation (email or link-only) */
export const createInvitation = async (body) => {
  const res = await api.post("/api/invitations/", body);
  return res.data;
};

/** List all pending invitations for a target (project or org) */
export const listInvitations = async (type, targetId) => {
  const res = await api.get(`/api/invitations/?type=${type}&target_id=${targetId}`);
  return res.data;
};

/** Resolve an invite token — public, no auth needed */
export const resolveToken = async (token) => {
  const res = await api.get(`/api/invitations/${token}`);
  return res.data;
};

/** Accept an invitation */
export const acceptInvitation = async (token) => {
  const res = await api.post(`/api/invitations/${token}/accept`);
  return res.data;
};

/** Decline an invitation */
export const declineInvitation = async (token) => {
  const res = await api.post(`/api/invitations/${token}/decline`);
  return res.data;
};

/** Revoke / cancel an invitation */
export const revokeInvitation = async (token) => {
  const res = await api.delete(`/api/invitations/${token}`);
  return res.data;
};
