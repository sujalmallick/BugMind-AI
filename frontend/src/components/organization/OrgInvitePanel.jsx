import { useState, useEffect } from "react";
import { Send, Link2, Clock, Check, Copy, Trash2, Loader2 } from "lucide-react";
import { createInvitation, listInvitations, revokeInvitation } from "../../api/invitationApi";
import useToasts from "../shared/useToasts";
import ConfirmDialog from "../shared/ConfirmDialog";

export default function OrgInvitePanel({ orgId }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null); // invite object to confirm revoke
  const [revoking, setRevoking] = useState(false);
  const { showToast } = useToasts();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await listInvitations("organization", orgId);
        setInvites(data);
      } catch (err) {
        showToast("Failed to load invitations: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  const handleSendEmailInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      const inv = await createInvitation({
        type: "organization",
        target_id: orgId,
        role: inviteRole,
        invited_email: inviteEmail.trim(),
      });
      setInvites((prev) => [inv, ...prev]);
      setInviteEmail("");
      showToast("Invitation sent!");
    } catch (err) {
      showToast(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const inv = await createInvitation({
        type: "organization",
        target_id: orgId,
        role: inviteRole,
      });
      setInvites((prev) => [inv, ...prev]);
      const link = `${window.location.origin}/invite/${inv.token}`;
      await navigator.clipboard.writeText(link);
      setCopiedToken(inv.token);
      setTimeout(() => setCopiedToken(null), 3000);
      showToast("Link copied to clipboard!");
    } catch (err) {
      showToast(err.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async (token) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
    showToast("Link copied!");
  };

  const handleRevokeInvite = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeInvitation(revokeTarget.token);
      setInvites(invites.filter((i) => i.token !== revokeTarget.token));
      showToast("Invitation revoked");
    } catch (err) {
      showToast(err.message);
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-muted" size={20} />
      </div>
    );
  }

  return (
    <div className="org-invite-panel"><div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Email Invite */}
        <div className="rounded-xl border border-hairline bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink mb-1">Invite via Email</h3>
          <p className="text-xs text-muted mb-4">Send a direct email invitation to join this organization.</p>
          <form onSubmit={handleSendEmailInvite} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:border-signal bg-white"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:border-signal"
                />
                <button
                  type="submit"
                  disabled={sending || !inviteEmail.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-signal px-4 py-2 text-sm font-bold text-white hover:bg-signal/90 transition disabled:opacity-50"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Share Link */}
        <div className="rounded-xl border border-hairline bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink mb-1">Invite via Link</h3>
          <p className="text-xs text-muted mb-4">Generate a shareable link. Anyone with this link can join.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:outline-none focus:border-signal bg-white"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="pt-5">
              <button
                onClick={handleGenerateLink}
                disabled={generatingLink}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white py-2 text-sm font-semibold text-ink hover:bg-paper hover:border-signal/40 transition disabled:opacity-50"
              >
                {generatingLink ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Generate & Copy Invite Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Invites List */}
      {invites.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-ink mb-3">Pending Invitations ({invites.length})</h3>
          <div className="divide-y divide-hairline rounded-xl border border-hairline bg-white">
            {invites.map((inv) => (
              <div key={inv.token} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-hairline">
                    <Clock size={14} className="text-muted" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {inv.invited_email || "Share link"}
                    </p>
                    <p className="text-xs text-muted">
                      <span className="capitalize text-signal">{inv.role}</span> · expires{" "}
                      {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "never"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!inv.invited_email && (
                    <button
                      onClick={() => handleCopyLink(inv.token)}
                      className="rounded p-2 text-muted hover:text-signal hover:bg-signal/5 transition"
                      title="Copy link"
                    >
                      {copiedToken === inv.token ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setRevokeTarget(inv)}
                    className="rounded p-2 text-muted hover:text-flagged hover:bg-flagged/5 transition"
                    title="Revoke invitation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    <ConfirmDialog open={!!revokeTarget} title="Revoke invitation?" message={`Are you sure you want to revoke the invitation for ${revokeTarget?.invited_email || "this share link"}? The link will stop working immediately.`} confirmText="Revoke" loading={revoking} onConfirm={handleRevokeInvite} onCancel={() => setRevokeTarget(null)} />
  </div>);
}
