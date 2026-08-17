import { useState, useEffect, useRef } from "react";
import { Loader2, User, ShieldCheck, Users, KeyRound, TriangleAlert, ArrowLeft, Menu, X, Bell } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAvatarUrl } from "../../utils/avatarUrl";

import { getProfile } from "../../auth/profileService";
import AccountInfo     from "../../components/profile/AccountInfo";
import SecuritySection from "../../components/profile/SecuritySection";
import MembershipsList from "../../components/profile/MembershipsList";
import ApiKeysSection  from "../../components/profile/ApiKeysSection";
import DangerZone      from "../../components/profile/DangerZone";
import ToastStack      from "../../components/shared/ToastStack";
import useToasts       from "../../components/shared/useToasts";
import NotificationPreferences from "../../components/notifications/NotificationPreferences";

import logo    from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";

// ── Nav config ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "account",      label: "Account",       icon: User,          desc: "Avatar, name, email" },
  { id: "security",     label: "Security",       icon: ShieldCheck,   desc: "Password & sessions" },
  { id: "notifications",label: "Notifications",  icon: Bell,          desc: "Email & in-app alerts" },
  { id: "orgs",         label: "Organizations",  icon: Users,         desc: "Teams & roles" },
  { id: "keys",         label: "AI Keys",        icon: KeyRound,      desc: "BYOK providers" },
  { id: "danger",       label: "Danger Zone",    icon: TriangleAlert, desc: "Delete account", danger: true },
];

/**
 * ProfilePage — /settings/profile
 * Sidebar nav with animated slide-in panel per section.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toasts, showToast } = useToasts();
  
  // Parse initial tab from URL
  const queryParams = new URLSearchParams(location.search);
  const tabFromUrl = queryParams.get("tab");
  
  const [activeTab, setActiveTab] = useState(
    TABS.some(t => t.id === tabFromUrl) ? tabFromUrl : "account"
  );
  
  const [prevTab, setPrevTab] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setError("Failed to load your profile."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tabFromUrl && TABS.some(t => t.id === tabFromUrl) && tabFromUrl !== activeTab) {
      switchTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  function switchTab(id) {
    if (id === activeTab || animating) return;
    setPrevTab(activeTab);
    setAnimating(true);
    setActiveTab(id);
    setMobileMenuOpen(false); // close mobile menu on selection
    setTimeout(() => setAnimating(false), 320);
    // Scroll panel to top on tab change
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }

  return (
    <div className="workspace-atmosphere min-h-screen">
      
      {/* Clean Solid Header */}
      <header className="sticky top-0 z-50 border-b border-hairline bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-8 sm:py-3.5 relative">
          
          {/* Left: Back Button */}
          <div className="flex-1 flex items-center justify-start">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="group flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>

          {/* Center: Logo */}
          <div className="flex-shrink-0 flex cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-90 absolute left-1/2 -translate-x-1/2" onClick={() => navigate("/")}>
            <img src={favicon} alt="BugMind" className="h-7 w-7 object-contain" />
            <img src={logo} alt="BugMind AI" className="h-8 w-auto object-contain hidden sm:block" />
          </div>

          {/* Right: Hamburger / Title */}
          <div className="flex-1 flex items-center justify-end gap-3">
            <span className="text-sm font-medium text-ink hidden sm:block">Profile Settings</span>
            
            {/* Hamburger Menu Toggle (Mobile only) */}
            <button 
              className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md text-muted hover:bg-paper hover:text-ink transition-colors"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>

        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">

        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-muted">
            <Loader2 size={24} className="animate-spin text-signal" />
            <span className="text-sm font-medium">Loading your profile…</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-flagged/30 bg-flagged-soft px-8 py-10 text-center max-w-md mx-auto">
            <p className="text-sm font-semibold text-flagged">{error}</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 lg:items-start w-full">

            {/* ── Sidebar nav (Left on desktop) ────────────────────────────────────────── */}
            <aside className="hidden lg:flex flex-col gap-1 w-56 shrink-0 sticky top-24">
              {/* User badge at top */}
              <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-hairline shadow-sm">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden text-sm font-bold text-white"
                  style={{ background: `hsl(${((profile?.id ?? 0) * 53) % 360},55%,48%)` }}
                >
                  {profile?.avatar_url ? (
                    <img src={getAvatarUrl(profile.avatar_url)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (profile?.name || profile?.email || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{profile?.name || "User"}</p>
                  <p className="truncate text-[11px] text-muted">{profile?.email}</p>
                </div>
              </div>

              {/* Nav items */}
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => switchTab(tab.id)}
                    className={`
                      group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200
                      ${active
                        ? tab.danger
                          ? "bg-flagged-soft border border-flagged/25 text-flagged shadow-sm"
                          : "bg-signal-soft border border-signal/20 text-signal shadow-sm"
                        : tab.danger
                          ? "text-flagged hover:bg-flagged-soft border border-transparent"
                          : "text-muted hover:bg-paper hover:text-ink border border-transparent"
                      }
                    `}
                  >
                    <div className={`
                      flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors
                      ${active
                        ? tab.danger ? "bg-flagged/15" : "bg-signal/15"
                        : "bg-hairline/60 group-hover:bg-hairline"
                      }
                    `}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold leading-tight">{tab.label}</p>
                      <p className={`text-[11px] leading-tight ${active ? "opacity-80" : "text-muted"}`}>{tab.desc}</p>
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* ── Content panel (Right on desktop) ───────────────────────────────────────── */}
            <div
              ref={panelRef}
              className="flex-1 min-w-0"
              style={{ animation: "profilePanelEnter 0.32s cubic-bezier(0.16,1,0.3,1) both" }}
              key={activeTab}
            >
              <PanelContent
                tab={activeTab}
                profile={profile}
                setProfile={setProfile}
                showToast={showToast}
              />
            </div>

            {/* ── Mobile Drawer Slider ─────────────────────────────────────── */}
            {mobileMenuOpen && (
              <div className="lg:hidden fixed inset-0 z-[100] flex justify-end">
                {/* Opaque Backdrop */}
                <div 
                  className="fixed inset-0 bg-ink/40 transition-opacity animate-in fade-in duration-200" 
                  onClick={() => setMobileMenuOpen(false)}
                />
                
                {/* Sliding panel (Right side) */}
                <div 
                  className="relative flex flex-col w-72 max-w-[85vw] h-full bg-white shadow-xl border-l border-hairline"
                  style={{ 
                    animation: "slideInRight 0.25s cubic-bezier(0.16,1,0.3,1) forwards" 
                  }}
                >
                  <style>{`
                    @keyframes slideInRight {
                      from { transform: translateX(100%); }
                      to { transform: translateX(0); }
                    }
                  `}</style>
                  
                  <div className="p-4 border-b border-hairline flex items-center justify-between">
                    <span className="font-semibold text-ink">Menu</span>
                    <button 
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1 rounded-md text-muted hover:bg-paper hover:text-ink transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
                    {TABS.map((tab) => {
                      const Icon = tab.icon;
                      const active = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => switchTab(tab.id)}
                          className={`
                            flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors
                            ${active
                              ? tab.danger
                                ? "bg-flagged-soft text-flagged"
                                : "bg-signal-soft text-signal"
                              : tab.danger
                                ? "text-flagged hover:bg-flagged-soft"
                                : "text-muted hover:bg-paper hover:text-ink"
                            }
                          `}
                        >
                          <div className={`
                            flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors
                            ${active
                              ? tab.danger ? "bg-flagged/15" : "bg-signal/15"
                              : "bg-hairline/60"
                            }
                          `}>
                            <Icon size={16} className={active ? "" : "opacity-70"} />
                          </div>
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <ToastStack toasts={toasts} />
    </div>
  );
}

// ── Panel renderer ──────────────────────────────────────────────────────────
function PanelContent({ tab, profile, setProfile, showToast }) {
  const heading = TABS.find((t) => t.id === tab);

  return (
    <div className="flex flex-col gap-1">
      {/* Section heading */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">{heading?.label}</h1>
        <p className="text-sm text-muted mt-0.5">{heading?.desc}</p>
      </div>

      {tab === "account" && (
        <AccountInfo
          profile={profile}
          onSaved={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
          showToast={showToast}
        />
      )}
      {tab === "security" && <SecuritySection showToast={showToast} />}
      {tab === "notifications" && <NotificationPreferences showToast={showToast} />}
      {tab === "orgs"     && <MembershipsList memberships={profile?.memberships} />}
      {tab === "keys"     && <ApiKeysSection showToast={showToast} />}
      {tab === "danger"   && <DangerZone showToast={showToast} />}
    </div>
  );
}
