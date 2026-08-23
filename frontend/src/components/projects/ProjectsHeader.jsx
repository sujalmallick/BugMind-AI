import { useState, useRef, useEffect } from "react";
import { Plus, LogOut, User, Users, Bell, LayoutDashboard, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getAvatarUrl } from "../../utils/avatarUrl";
import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";
import NotificationsDrawer from "../layout/NotificationsDrawer";
import { fetchNotifications } from "../../services/notificationService";

// ── Shared icon-only button ──────────────────────────────────────────────────
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

export default function ProjectsHeader({ onCreateProject }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef(null);

  // ── Click-outside ──────────────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Unread count ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchNotifications()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.items ?? []);
        setUnreadCount(list.filter((n) => !n.is_read).length);
      })
      .catch(() => {});
  }, [user, profileOpen]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initials = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-hairline bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">

          {/* ── Left: Logo & Project Hub ────────────────────────────────── */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex shrink-0 items-center gap-2.5 transition-opacity duration-150 hover:opacity-85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 rounded-sm py-1"
              aria-label="BugMind AI — home"
            >
              <img src={favicon} alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
              <img src={logo} alt="BugMind AI" className="h-[32px] w-auto object-contain" />
            </button>

            {/* Vertical divider */}
            <div className="h-6 w-px shrink-0 bg-hairline" aria-hidden="true" />

            {/* Project Hub indicator */}
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Layers size={14} aria-hidden="true" className="text-signal" />
              <span>Project Hub</span>
            </div>
          </div>

          {/* ── Right cluster ────────────────────────────────────────────── */}
          <div className="flex items-center gap-2.5">

            {/* New Project — Blue primary button */}
            <button
              type="button"
              onClick={onCreateProject}
              className="
                inline-flex items-center gap-1.5
                rounded-md border border-signal/20 bg-signal px-3.5 py-1.5
                text-[13px] font-semibold text-white shadow-sm
                transition-all duration-150
                hover:bg-signal/90 hover:shadow
                active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40
              "
            >
              <Plus size={15} aria-hidden="true" className="shrink-0" />
              <span>New Project</span>
            </button>

            {/* Notifications */}
            <IconBtn onClick={() => setNotificationsOpen(true)} label="Notifications">
              <Bell size={14} aria-hidden="true" />
              {unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread`}
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

                {/* Dropdown */}
                {profileOpen && (
                  <div className="
                    absolute right-0 top-full z-50 mt-2
                    w-60 rounded-lg border border-hairline bg-surface
                    py-1 shadow-md
                  ">
                    {/* User info */}
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

      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onCountChange={setUnreadCount}
      />
    </>
  );
}
