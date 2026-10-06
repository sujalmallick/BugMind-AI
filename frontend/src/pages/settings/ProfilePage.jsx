import { useState, useEffect, useRef } from "react";
import { Loader2, User, ShieldCheck, Users, KeyRound, TriangleAlert, Bell } from "lucide-react";
import { useLocation } from "react-router-dom";
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
import PageHeading     from "../../components/shared/PageHeading";
import HeaderBar       from "../../components/layout/HeaderBar";
import AppFooter       from "../../components/layout/AppFooter";
import SegmentedControl from "../../components/shared/SegmentedControl";



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
    setTimeout(() => setAnimating(false), 320);
    // Scroll panel to top on tab change
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }

  return (
    <div className="workspace-atmosphere flex min-h-screen flex-col">
      <HeaderBar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <div className="section-enter">
          <PageHeading meta="Manage your account, security, notifications and AI providers.">
            Settings
          </PageHeading>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-32 text-muted" role="status">
            <Loader2 size={20} className="spin text-signal" aria-hidden="true" />
            <span className="text-sm">Loading your profile…</span>
          </div>
        ) : error ? (
          <div className="mx-auto mt-10 max-w-md rounded-xl border border-flagged/25 bg-flagged-soft px-8 py-10 text-center">
            <p className="text-sm font-medium text-flagged">{error}</p>
          </div>
        ) : (
          <div className="section-enter section-enter-1 mt-7 flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            {/* Phones/tablets: swipeable section switcher */}
            <div className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:hidden">
              <SegmentedControl
                label="Settings sections"
                value={activeTab}
                onChange={switchTab}
                options={TABS.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
              />
            </div>

            {/* Desktop sidebar */}
            <aside className="hidden w-60 shrink-0 lg:sticky lg:top-24 lg:block">
              <div className="glass-card flex items-center gap-3 px-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-signal-soft text-[13px] font-semibold text-signal">
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

              <nav aria-label="Settings sections" className="mt-4 flex flex-col gap-0.5">
                {TABS.filter((t) => !t.danger).map((tab) => <NavItem key={tab.id} tab={tab} activeTab={activeTab} onSelect={switchTab} />)}
                <div className="my-2 h-px bg-hairline" />
                {TABS.filter((t) => t.danger).map((tab) => <NavItem key={tab.id} tab={tab} activeTab={activeTab} onSelect={switchTab} />)}
              </nav>
            </aside>

            {/* Section content */}
            <div ref={panelRef} key={activeTab} className="animate-tab-enter min-w-0 flex-1">
              <PanelContent
                tab={activeTab}
                profile={profile}
                setProfile={setProfile}
                showToast={showToast}
              />
            </div>
          </div>
        )}
      </main>

      <AppFooter />
      <ToastStack toasts={toasts} />
    </div>
  );
}

// ── Sidebar item ────────────────────────────────────────────────────────────
function NavItem({ tab, activeTab, onSelect }) {
  const Icon = tab.icon;
  const active = activeTab === tab.id;
  const tone = tab.danger
    ? active
      ? "bg-flagged-soft text-flagged"
      : "text-flagged/80 hover:bg-flagged-soft hover:text-flagged"
    : active
      ? "bg-ink/[0.05] text-ink"
      : "text-muted hover:bg-ink/[0.03] hover:text-ink";
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      aria-current={active ? "page" : undefined}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 ${tone}`}
    >
      <Icon size={16} aria-hidden="true" className={active && !tab.danger ? "text-signal" : ""} />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-tight">{tab.label}</span>
        <span className={`block truncate text-[11px] leading-tight ${active ? "opacity-70" : "text-muted"}`}>{tab.desc}</span>
      </span>
    </button>
  );
}


// ── Panel renderer ──────────────────────────────────────────────────────────
function PanelContent({ tab, profile, setProfile, showToast }) {
  return (
    <div className="flex flex-col">

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
