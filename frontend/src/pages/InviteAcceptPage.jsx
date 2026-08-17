import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Building2,
  FolderKanban,
  Clock,
  AlertCircle,
  ArrowRight,
  LogIn,
} from "lucide-react";
import { resolveToken, acceptInvitation, declineInvitation } from "../api/invitationApi";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/bugmind2.png";
import favicon from "../assets/favicon.png";

const ROLE_COLORS = {
  owner: "text-amber-700 bg-amber-50 border-amber-200",
  admin: "text-purple-700 bg-purple-50 border-purple-200",
  editor: "text-blue-700 bg-blue-50 border-blue-200",
  viewer: "text-slate-700 bg-slate-50 border-slate-200",
  member: "text-green-700 bg-green-50 border-green-200",
};

const STATUS_CONFIG = {
  accepted: { icon: CheckCircle, color: "text-green-600", label: "Already accepted" },
  declined: { icon: XCircle, color: "text-slate-500", label: "Previously declined" },
  revoked: { icon: AlertCircle, color: "text-red-500", label: "This invitation has been revoked" },
  expired: { icon: AlertCircle, color: "text-red-500", label: "This invitation has expired" },
};

export default function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, authenticated } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [result, setResult] = useState(null); // 'accepted' | 'declined'
  const [error, setError] = useState(null);

  useEffect(() => {
    resolveToken(token)
      .then(setInvite)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  // If user just came back from login with a pending invite, auto-process
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingInviteToken");
    if (pending && authenticated && pending === token && invite?.status === "pending") {
      sessionStorage.removeItem("pendingInviteToken");
    }
  }, [authenticated, token, invite]);

  const handleAccept = async () => {
    if (!authenticated) {
      sessionStorage.setItem("pendingInviteToken", token);
      navigate(`/login?redirect=/invite/${token}`);
      return;
    }
    setActing(true);
    try {
      await acceptInvitation(token);
      setResult("accepted");
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!authenticated) {
      navigate(`/login?redirect=/invite/${token}`);
      return;
    }
    setActing(true);
    try {
      await declineInvitation(token);
      setResult("declined");
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  const goToDashboard = () => navigate("/");

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      
      <div className="relative w-full max-w-md">
        {/* Logo Header */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-3">
            <img src={favicon} alt="BugMind" className="h-9 w-9 object-contain" />
            <img src={logo} alt="BugMind AI" className="h-10 w-auto object-contain" />
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-white shadow-xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500" />

          <div className="p-8">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="animate-spin text-signal" size={36} />
                <p className="text-muted text-sm">Verifying invitation…</p>
              </div>
            )}

            {/* Error */}
            {!loading && error && !result && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-100">
                  <AlertCircle size={32} className="text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink">Invalid Invitation</h2>
                  <p className="mt-1 text-sm text-muted">{error}</p>
                </div>
                <button onClick={goToDashboard} className="mt-4 flex items-center gap-2 rounded-xl bg-surface border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-paper transition">
                  Go to Dashboard <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* Already actioned / expired / revoked */}
            {!loading && !error && invite && invite.status !== "pending" && !result && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                {(() => {
                  const cfg = STATUS_CONFIG[invite.status] || STATUS_CONFIG.expired;
                  const Icon = cfg.icon;
                  return (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface border border-hairline">
                        <Icon size={32} className={cfg.color} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-ink capitalize">{invite.status}</h2>
                        <p className="mt-1 text-sm text-muted">{cfg.label}</p>
                      </div>
                      <button onClick={goToDashboard} className="mt-4 flex items-center gap-2 rounded-xl bg-surface border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-paper transition">
                        Go to Dashboard <ArrowRight size={14} />
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Result screen */}
            {result && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                {result === "accepted" ? (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 border border-green-100">
                      <CheckCircle size={32} className="text-green-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-ink">You're In! 🎉</h2>
                      <p className="mt-2 text-sm text-muted">
                        You now have access to{" "}
                        <span className="text-ink font-semibold">{invite?.target_name}</span>.
                      </p>
                    </div>
                    <button onClick={goToDashboard} className="mt-4 flex items-center gap-2 rounded-xl bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal/90 transition shadow-lg shadow-signal/30">
                      Open Dashboard <ArrowRight size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 border border-hairline">
                      <XCircle size={32} className="text-slate-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-ink">Invitation Declined</h2>
                      <p className="mt-2 text-sm text-muted">You have declined this invitation.</p>
                    </div>
                    <button onClick={goToDashboard} className="mt-4 flex items-center gap-2 rounded-xl bg-surface border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-paper transition">
                      Go to Dashboard <ArrowRight size={14} />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Main invite card */}
            {!loading && !error && !result && invite && invite.status === "pending" && (
              <div className="flex flex-col gap-6">
                {/* Type icon + target name */}
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface border border-hairline shadow-sm">
                      {invite.type === "organization"
                        ? <Building2 size={26} className="text-violet-500" />
                        : <FolderKanban size={26} className="text-blue-500" />}
                    </div>
                  </div>
                  <p className="text-sm text-muted mb-1">You've been invited to join</p>
                  <h2 className="text-2xl font-bold text-ink">{invite.target_name}</h2>
                  <p className="text-sm text-muted mt-1 capitalize font-medium">
                    {invite.type === "organization" ? "Organization" : "Project"}
                  </p>
                </div>

                {/* Details card */}
                <div className="rounded-xl border border-hairline bg-surface p-4 space-y-3">
                  {invite.inviter && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted font-medium">Invited by</span>
                      <span className="text-ink font-semibold">{invite.inviter.name || invite.inviter.email}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted font-medium">Your role</span>
                    <span className={`capitalize rounded-full border px-3 py-0.5 text-xs font-bold ${ROLE_COLORS[invite.role] || ROLE_COLORS.viewer}`}>
                      {invite.role}
                    </span>
                  </div>
                  {invite.expires_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted font-medium">Expires</span>
                      <span className="text-ink font-medium flex items-center gap-1.5">
                        <Clock size={14} className="text-muted" />
                        {new Date(invite.expires_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Not logged in warning */}
                {!authenticated && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <LogIn size={18} className="shrink-0 mt-0.5 text-amber-600" />
                    <span className="font-medium">You must be signed in to accept. We'll redirect you after login.</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleDecline}
                    disabled={acting}
                    className="flex-1 rounded-xl border border-hairline bg-white py-3 text-sm font-semibold text-ink hover:bg-surface transition disabled:opacity-40 shadow-sm"
                  >
                    Decline
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={acting}
                    className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-signal py-3 text-sm font-bold text-white hover:bg-signal/90 transition shadow-lg shadow-signal/30 disabled:opacity-40"
                  >
                    {acting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        {authenticated ? "Accept Invitation" : "Sign in & Accept"}
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted font-medium">
          BugMind AI — Collaborative QA Platform
        </p>
      </div>
    </div>
  );
}
