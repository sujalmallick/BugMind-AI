import { useState, useRef, useEffect, useCallback } from "react";
import logo from "../../assets/bugmind2.png";
import {
  Search,
  LogOut,
  User,
  Users,
  Bell,
  KeyRound,
  LayoutDashboard,
  Folder,
  ChevronDown,
  CloudCheck,
  Check,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../../utils/time";
import { useAuth } from "../../auth/AuthContext";
import favicon from "../../assets/favicon.png";
import AISettingsModal from "../common/AISettingsModal";
import { getAvatarUrl } from "../../utils/avatarUrl";
import useToasts from "../shared/useToasts";
import ToastStack from "../shared/ToastStack";
import NotificationsDrawer from "../layout/NotificationsDrawer";
import { getUnreadCount } from "../../services/notificationService";
import { useSSENotifications } from "../../hooks/useSSENotifications";
import { getAISettings } from "../../services/aiSettingsApi";
import { getProjects } from "../../services/projectApi";

// ── Shared button anatomy ────────────────────────────────────────────────────
// icon-only square button (34×34)
function IconBtn({ onClick, label, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`
        relative flex h-[34px] w-[34px] items-center justify-center
        rounded-md border border-hairline bg-surface
        text-muted transition-colors duration-150
        hover:border-ink/30 hover:bg-paper hover:text-ink
        active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40
        ${className}
      `}
    >
      {children}
    </button>
  );
}

export default function HeaderBar({
  connected = true,
  onOpenCommandPalette,
  projectName,
  projectId,
  updatedAt,
}) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const { toasts, showToast } = useToasts();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const profileRef = useRef(null);
  const projectSelectorRef = useRef(null);

  // ── AI key check ────────────────────────────────────────────────────────────
  const checkKey = useCallback(async () => {
    try {
      const settings = await getAISettings();
      const activeProvider = settings?.provider || "gemini";
      const providers = settings?.providers || {};
      const activeStatus = providers[activeProvider];
      setHasApiKey(activeStatus ? activeStatus.has_key : false);
    } catch {
      setHasApiKey(false);
    }
  }, []);

  useEffect(() => {
    if (user) checkKey();
  }, [user, checkKey]);

  // ── Click-outside ────────────────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (
        projectSelectorRef.current &&
        !projectSelectorRef.current.contains(event.target)
      ) {
        setProjectSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Unread count ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, [user]);

  useSSENotifications({
    enabled: !!user,
    onSignal: useCallback((signal) => {
      if (
        signal.event === "new_notification" &&
        typeof signal.unread_count === "number"
      ) {
        setUnreadCount(signal.unread_count);
      }
    }, []),
  });

  // ── Project selector ─────────────────────────────────────────────────────────
  const openProjectSelector = async () => {
    if (projectSelectorOpen) {
      setProjectSelectorOpen(false);
      return;
    }
    setProjectSelectorOpen(true);
    if (projects.length === 0) {
      setProjectsLoading(true);
      try {
        const list = await getProjects();
        setProjects(list);
      } catch {
        /* ignore */
      } finally {
        setProjectsLoading(false);
      }
    }
  };

  // ── Keyboard shortcut ────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const shortcutPressed = isMac
        ? e.metaKey && e.key === "k"
        : e.ctrlKey && e.key === "k";
      if (shortcutPressed) {
        e.preventDefault();
        onOpenCommandPalette?.();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenCommandPalette]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // ── Avatar initials ──────────────────────────────────────────────────────────
  const initials = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-hairline bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">

          {/* ── Left cluster ─────────────────────────────────────────────── */}
          <div className="flex min-w-0 items-center gap-4">

            {/* Logo — favicon + wordmark image */}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex shrink-0 items-center gap-2.5 transition-opacity duration-150 hover:opacity-85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 rounded-sm py-1"
              aria-label="BugMind AI — go to projects"
            >
              <img src={favicon} alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
              <img src={logo} alt="BugMind AI" className="h-[32px] w-auto object-contain" />
            </button>

            {/* Vertical divider */}
            {projectName && (
              <div className="h-6 w-px shrink-0 bg-hairline" aria-hidden="true" />
            )}

            {/* Project selector — dropdown trigger */}
            {projectName && (
              <div className="relative min-w-0" ref={projectSelectorRef}>
                <button
                  type="button"
                  onClick={openProjectSelector}
                  aria-haspopup="listbox"
                  aria-expanded={projectSelectorOpen}
                  className="
                    flex min-w-0 items-center gap-1.5
                    rounded-md px-1.5 py-1
                    text-[13px] font-medium text-ink
                    transition-colors duration-150
                    hover:bg-paper
                    active:scale-[0.98]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40
                  "
                >
                  <Folder size={13} aria-hidden="true" className="shrink-0 text-muted" />
                  <span className="max-w-[160px] truncate sm:max-w-[220px]">
                    {projectName}
                  </span>
                  <ChevronDown
                    size={12}
                    aria-hidden="true"
                    className={`shrink-0 text-muted transition-transform duration-150 ${
                      projectSelectorOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown */}
                {projectSelectorOpen && (
                  <div
                    role="listbox"
                    aria-label="Switch project"
                    className="
                      absolute left-0 top-full z-50 mt-1.5
                      w-64 rounded-lg border border-hairline bg-surface
                      py-1 shadow-md
                    "
                  >
                    <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Switch project
                    </p>

                    {projectsLoading && (
                      <p className="px-3 py-2 text-[12px] text-muted">
                        Loading…
                      </p>
                    )}

                    {!projectsLoading && projects.length === 0 && (
                      <p className="px-3 py-2 text-[12px] text-muted">
                        No projects found.
                      </p>
                    )}

                    {!projectsLoading &&
                      projects.map((proj) => {
                        const isCurrent = proj.id === projectId;
                        return (
                          <button
                            key={proj.id}
                            role="option"
                            aria-selected={isCurrent}
                            type="button"
                            onClick={() => {
                              setProjectSelectorOpen(false);
                              navigate(`/project/${proj.id}/workspace`);
                            }}
                            className={`
                              flex w-full items-center gap-2.5 px-3 py-2
                              text-[13px] font-medium text-left
                              transition-colors duration-100
                              hover:bg-paper
                              ${isCurrent ? "text-signal" : "text-ink"}
                            `}
                          >
                            <Folder
                              size={13}
                              aria-hidden="true"
                              className={isCurrent ? "text-signal" : "text-muted"}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {proj.name}
                            </span>
                            {isCurrent && (
                              <Check
                                size={12}
                                aria-hidden="true"
                                className="shrink-0 text-signal"
                              />
                            )}
                          </button>
                        );
                      })}

                    <div className="my-1 h-px bg-hairline" />
                    <button
                      type="button"
                      onClick={() => {
                        setProjectSelectorOpen(false);
                        navigate("/");
                      }}
                      className="
                        flex w-full items-center gap-2.5 px-3 py-2
                        text-[13px] font-medium text-muted text-left
                        hover:bg-paper hover:text-ink
                        transition-colors duration-100
                      "
                    >
                      All projects →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sync status — non-interactive, mono font */}
            {updatedAt && (
              <div
                className="hidden items-center gap-1.5 sm:flex"
                title={new Date(updatedAt).toLocaleString()}
              >
                <CloudCheck
                  size={13}
                  aria-hidden="true"
                  className="shrink-0 text-muted"
                />
                <span className="font-mono text-[11px] text-muted hidden lg:block">
                  {formatRelativeTime(updatedAt)}
                </span>
              </div>
            )}
          </div>

          {/* ── Right cluster ────────────────────────────────────────────── */}
          <div className="flex items-center gap-2.5">

            {/* Add AI key — only when no key, warning-tinted, not gradient */}
            {!hasApiKey && (
              <button
                type="button"
                onClick={() => setAiModalOpen(true)}
                title="No AI key configured — click to add"
                className="
                  hidden sm:inline-flex items-center gap-1.5
                  rounded-md border border-ochre/50 bg-ochre-soft px-2.5 py-1.5
                  text-[13px] font-medium text-ochre
                  transition-colors duration-150
                  hover:border-ochre/70 hover:bg-ochre/10
                  active:scale-[0.98]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre/40
                "
              >
                <KeyRound size={13} aria-hidden="true" className="shrink-0" />
                <span>Add AI key</span>
                {/* Mobile: icon-only */}
              </button>
            )}

            {/* Add AI key — mobile icon-only */}
            {!hasApiKey && (
              <button
                type="button"
                onClick={() => setAiModalOpen(true)}
                aria-label="Add AI key"
                title="No AI key configured — click to add"
                className="
                  sm:hidden relative flex h-[30px] w-[30px] items-center justify-center
                  rounded-md border border-ochre/50 bg-ochre-soft
                  text-ochre transition-colors duration-150
                  hover:border-ochre/70 hover:bg-ochre/10
                  active:scale-[0.98]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre/40
                "
              >
                <KeyRound size={14} aria-hidden="true" />
              </button>
            )}

            {/* Key configured — subtle settings entry point in profile dropdown only; no visible pill here */}

            {/* Search — icon-only, Ctrl+K wired in useEffect above */}
            <IconBtn
              onClick={onOpenCommandPalette}
              label="Search (Ctrl+K)"
            >
              <Search size={14} aria-hidden="true" />
            </IconBtn>

            {/* Notifications */}
            <IconBtn
              onClick={() => setNotificationsOpen(true)}
              label="Notifications"
            >
              <Bell size={14} aria-hidden="true" />
              {unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread notifications`}
                  className="
                    pointer-events-none absolute -right-1 -top-1
                    flex h-[14px] min-w-[14px] items-center justify-center
                    rounded-full bg-flagged px-[3px]
                    font-mono text-[9px] font-bold text-white
                    ring-1 ring-surface
                  "
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </IconBtn>

            {/* Avatar + Profile dropdown */}
            {user && (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-label="Open profile menu"
                  aria-haspopup="true"
                  aria-expanded={profileOpen}
                  className="
                    flex h-7 w-7 items-center justify-center
                    rounded-full overflow-hidden
                    bg-signal-soft text-signal text-[12px] font-semibold
                    ring-1 ring-hairline
                    transition-shadow duration-150
                    hover:ring-2 hover:ring-signal/30
                    active:scale-[0.98]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40
                  "
                >
                  {user.avatar_url ? (
                    <img
                      src={getAvatarUrl(user.avatar_url)}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span aria-hidden="true">{initials}</span>
                  )}
                </button>

                {/* Profile dropdown */}
                {profileOpen && (
                  <div className="
                    absolute right-0 top-full z-50 mt-2
                    w-60 rounded-lg border border-hairline bg-surface
                    py-1 shadow-md
                  ">
                    {/* User info header */}
                    <div className="px-3 py-2.5">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {user.name || "User"}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted">
                        {user.email}
                      </p>
                    </div>

                    <div className="my-1 h-px bg-hairline" />

                    <div className="flex flex-col">
                      {[
                        {
                          icon: User,
                          label: "Profile Settings",
                          action: () => { setProfileOpen(false); navigate("/settings/profile?tab=account"); },
                        },
                        {
                          icon: LayoutDashboard,
                          label: "Dashboard",
                          action: () => { setProfileOpen(false); navigate("/dashboard"); },
                        },
                        {
                          icon: Users,
                          label: "Organizations",
                          action: () => { setProfileOpen(false); navigate("/organizations"); },
                        },
                      ].map(({ icon: Icon, label, action }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={action}
                          className="
                            flex w-full items-center gap-2.5 px-3 py-2
                            text-[13px] font-medium text-ink text-left
                            hover:bg-paper
                            transition-colors duration-100
                          "
                        >
                          <Icon size={14} aria-hidden="true" className="shrink-0 text-muted" />
                          {label}
                        </button>
                      ))}

                      {/* Notifications with badge */}
                      <button
                        type="button"
                        onClick={() => { setProfileOpen(false); setNotificationsOpen(true); }}
                        className="
                          flex w-full items-center justify-between px-3 py-2
                          text-[13px] font-medium text-ink text-left
                          hover:bg-paper
                          transition-colors duration-100
                        "
                      >
                        <span className="flex items-center gap-2.5">
                          <Bell size={14} aria-hidden="true" className="shrink-0 text-muted" />
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <span className="font-mono text-[11px] font-semibold text-flagged">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </button>

                      {/* AI Key settings */}
                      <button
                        type="button"
                        onClick={() => { setProfileOpen(false); setAiModalOpen(true); }}
                        className="
                          flex w-full items-center gap-2.5 px-3 py-2
                          text-[13px] font-medium text-ink text-left
                          hover:bg-paper
                          transition-colors duration-100
                        "
                      >
                        <KeyRound size={14} aria-hidden="true" className="shrink-0 text-muted" />
                        <span className="flex-1">AI Key</span>
                        {hasApiKey ? (
                          <span className="font-mono text-[11px] text-verified">configured</span>
                        ) : (
                          <span className="font-mono text-[11px] text-ochre">not set</span>
                        )}
                      </button>
                    </div>

                    <div className="my-1 h-px bg-hairline" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="
                        flex w-full items-center gap-2.5 px-3 py-2
                        text-[13px] font-medium text-flagged text-left
                        hover:bg-flagged-soft
                        transition-colors duration-100
                      "
                    >
                      <LogOut size={14} aria-hidden="true" className="shrink-0" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* AI Settings Modal */}
      <AISettingsModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onKeySaved={() => {
          setAiModalOpen(false);
          checkKey();
          showToast("Key connected successfully!");
        }}
        onKeyDeleted={(provider) => {
          checkKey();
          const label = provider.charAt(0).toUpperCase() + provider.slice(1);
          showToast(`${label} API key deleted.`);
        }}
      />

      <ToastStack toasts={toasts} />

      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onCountChange={setUnreadCount}
      />
    </>
  );
}