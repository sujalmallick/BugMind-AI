import { useState, useRef, useEffect } from "react";
import { Plus, LogOut, User, Users, Bell, LayoutDashboard, Sparkles, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getAvatarUrl } from "../../utils/avatarUrl";
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
    if (user) {
      fetchNotifications()
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.items ?? []);
          setUnreadCount(list.filter(n => !n.is_read).length);
        })
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
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
        {/* Top accent gradient bar */}
        <div className="h-0.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 w-full" />

        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">

          {/* Logo & Hub Branding */}
          <div className="flex items-center gap-3.5">
            <div
              title="Go to Projects"
              onClick={() => navigate("/")}
              className="group flex cursor-pointer items-center gap-3 transition-transform duration-200 active:scale-95"
            >
              <img
                src={favicon}
                alt="BugMind"
                className="h-10 w-10 object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <img
                src={logo}
                alt="BugMind AI"
                className="h-9 w-auto object-contain transition-opacity duration-200 group-hover:opacity-85"
              />
            </div>

            <div className="hidden border-l border-gray-200 pl-4 sm:flex flex-col">
              <div className="flex items-center gap-1.5">
                <Layers size={13} className="text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  Project Hub
                </span>
              </div>
              <span className="text-[11px] font-medium text-gray-400">
                {currentDate}
              </span>
            </div>
          </div>

          {/* Actions & Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 lg:inline-flex items-center gap-2 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Workspace Ready
            </span>

            {/* Create Project Button */}
            <button
              type="button"
              onClick={onCreateProject}
              className="btn-primary btn-shine flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-md transition-all duration-200 active:scale-95"
            >
              <Plus size={17} />
              <span>New Project</span>
            </button>

            {/* Bell Notification Button */}
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200/80 bg-gray-50/70 text-gray-600 transition-all duration-200 hover:border-blue-300 hover:bg-white hover:text-blue-600 active:scale-90"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white shadow-xs ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            {user && (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 rounded-full p-0.5 transition-all duration-200 hover:ring-2 hover:ring-blue-500/30 focus:outline-none"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-sm font-bold text-white shadow-xs ring-2 ring-white">
                    {user.avatar_url ? (
                      <img
                        src={getAvatarUrl(user.avatar_url)}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (user.name || user.email || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                </button>

                {/* Dropdown Menu */}
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2.5 w-64 origin-top-right rounded-2xl border border-gray-200/90 bg-white/95 p-2 shadow-xl backdrop-blur-lg menu-enter z-50">
                    <div className="px-3.5 py-3 rounded-xl bg-gray-50/80 border border-gray-100">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-gray-900">
                          {user.name || "User"}
                        </p>
                        <span className="shrink-0 rounded-md bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-gray-500 border border-gray-200 shadow-2xs">
                          ID: {user.id}
                        </span>
                      </div>
                      <p className="truncate text-xs text-gray-400 mt-0.5 font-medium">
                        {user.email}
                      </p>
                    </div>

                    <div className="my-2 h-px w-full bg-gray-100" />

                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => { setProfileOpen(false); navigate("/settings/profile?tab=account"); }}
                        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        <User size={16} className="text-gray-400 group-hover:text-blue-600" />
                        Profile Settings
                      </button>

                      <button
                        type="button"
                        onClick={() => { setProfileOpen(false); navigate("/dashboard"); }}
                        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        <LayoutDashboard size={16} className="text-gray-400" />
                        Dashboard
                      </button>

                      <button
                        type="button"
                        onClick={() => { setProfileOpen(false); navigate("/organizations"); }}
                        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Users size={16} className="text-gray-400" />
                        Organizations
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setNotificationsOpen(true);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        <div className="flex items-center gap-3">
                          <Bell size={16} className="text-gray-400" />
                          Notifications
                        </div>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white leading-none">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </button>

                      <div className="my-2 h-px w-full bg-gray-100" />

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LogOut size={16} />
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
