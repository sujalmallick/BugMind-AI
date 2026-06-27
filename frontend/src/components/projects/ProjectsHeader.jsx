import { useState, useRef, useEffect } from "react";
import { Plus, LogOut, User, Users, Bell, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";
import NotificationsDrawer from "../layout/NotificationsDrawer";
import { fetchNotifications } from "../../services/notificationService";

export default function ProjectsHeader({
  onCreateProject,
}) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (user && (profileOpen || !profileOpen)) { // fetch on mount and on menu open
      fetchNotifications()
        .then(data => setUnreadCount(data.filter(n => !n.is_read).length))
        .catch(() => {});
    }
  }, [user, profileOpen]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const currentDate = new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date());

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-hairline/70 bg-white/90 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-8 sm:py-4">

        {/* Logo */}
        <div
          title="Go to Projects"
          onClick={() => navigate("/")}
          className="group flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
        >
          <img
            src={favicon}
            alt="BugMind"
            className="h-10 w-10 object-contain"
          />

          <img
            src={logo}
            alt="BugMind AI"
            className="h-11 w-auto object-contain"
          />

          <div className="hidden border-l border-hairline pl-3 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Project Hub
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {currentDate}
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden rounded-full border border-hairline bg-paper px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted lg:inline-flex">
            Workspace Ready
          </span>

          <button
            type="button"
            onClick={onCreateProject}
            className="btn-primary"
          >
            <Plus size={16} />
            New Project
          </button>

          {/* Profile Dropdown */}
          {user && (
            <div className="relative ml-1 sm:ml-2" ref={profileRef}>
              {/* Avatar wrapper — separate from overflow-hidden so badge shows */}
              <div className="relative cursor-pointer" onClick={() => setProfileOpen(!profileOpen)}>
                <div 
                  className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-signal to-indigo-600 text-[13px] font-bold text-white shadow-sm ring-2 ring-transparent transition hover:ring-signal/30"
                >
                  {user.avatar_url ? (
                    <img
                      src={`http://localhost:8000/${user.avatar_url}`}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (user.name || user.email || "?").charAt(0).toUpperCase()
                  )}
                </div>
                {/* Unread badge */}
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white z-10">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </div>

                {/* Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl border border-hairline bg-white p-1.5 shadow-lg menu-enter z-50">
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">
                        {user.name || "User"}
                      </p>
                      <span className="shrink-0 rounded bg-paper px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted border border-hairline" title="User ID">
                        ID: {user.id}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted">
                      {user.email}
                    </p>
                  </div>
                
                <div className="my-1 h-px w-full bg-hairline" />

                <div className="p-1.5 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => navigate("/settings/profile?tab=account")}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition hover:bg-paper"
                  >
                    <User size={15} className="text-muted" />
                    Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/my-work")}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition hover:bg-paper"
                  >
                    <Briefcase size={15} className="text-muted" />
                    My Work
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/organizations")}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition hover:bg-paper"
                  >
                    <Users size={15} className="text-muted" />
                    Organizations
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setNotificationsOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition hover:bg-paper"
                  >
                    <div className="relative flex items-center justify-center">
                      <Bell size={15} className="text-muted" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-flagged border border-white"></span>
                      )}
                    </div>
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto flex items-center justify-center rounded-full bg-flagged px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  <div className="my-1 h-px w-full bg-hairline" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-flagged transition hover:bg-flagged-soft"
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
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
