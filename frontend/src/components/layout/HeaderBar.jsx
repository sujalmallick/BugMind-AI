import { useState, useRef, useEffect, useCallback } from "react";
import { Search, LogOut, User, Users, Bell, KeyRound, LayoutDashboard, Sparkles, Folder } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../../utils/time";
import { useAuth } from "../../auth/AuthContext";
import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";
import AISettingsModal from "../common/AISettingsModal";
import { getAvatarUrl } from "../../utils/avatarUrl";
import useToasts from "../shared/useToasts";
import ToastStack from "../shared/ToastStack";
import NotificationsDrawer from "../layout/NotificationsDrawer";
import { getUnreadCount } from "../../services/notificationService";
import { useSSENotifications } from "../../hooks/useSSENotifications";
import { getAISettings } from "../../services/aiSettingsApi";

export default function HeaderBar({
  connected = true,
  onOpenCommandPalette,
  projectName,
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
  const profileRef = useRef(null);

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
    if (user) {
      checkKey();
    }
  }, [user, checkKey]);

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
    if (!user) return;
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, [user]);

  useSSENotifications({
    enabled: !!user,
    onSignal: useCallback((signal) => {
      if (signal.event === "new_notification" && typeof signal.unread_count === "number") {
        setUnreadCount(signal.unread_count);
      }
    }, []),
  });

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const shortcut =
    navigator.platform.toUpperCase().includes("MAC")
      ? "⌘K"
      : "Ctrl+K";

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
        {/* Top accent gradient bar */}
        <div className="h-0.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 w-full" />

        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">

          {/* Left section: Logo & Project context */}
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-5">
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

            {projectName && (
              <>
                <div className="h-6 w-px bg-gray-200" />

                <div className="flex items-center gap-2.5 min-w-0 max-w-[45vw] sm:max-w-none">
                  <div className="flex items-center gap-2 rounded-xl bg-blue-50/80 border border-blue-100/90 px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-900 truncate shadow-2xs">
                    <Folder size={15} className="text-blue-600 shrink-0" />
                    <span className="truncate">{projectName}</span>
                  </div>

                  {updatedAt && (
                    <div className="hidden items-center gap-2 text-xs text-gray-500 sm:flex">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="text-xs font-medium text-gray-400">
                        {formatRelativeTime(updatedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right section: Global Actions */}
          <div className="flex items-center gap-2.5 text-sm sm:gap-3.5">

            {/* BYOK API Key Button */}
            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              title={hasApiKey ? "AI Model API Key Active" : "No API Key Set! Click to configure"}
              className={`
                hidden sm:inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold
                shadow-2xs transition-all duration-200 active:scale-95 group relative overflow-hidden
                ${
                  hasApiKey
                    ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100/80 hover:border-emerald-300"
                    : "border-amber-200 bg-amber-50/90 text-amber-800 hover:bg-amber-100/90 hover:border-amber-300 animate-pulse"
                }
              `}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    hasApiKey ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    hasApiKey ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </span>

              <KeyRound
                size={16}
                className={`transition-transform duration-300 group-hover:rotate-12 ${
                  hasApiKey ? "text-emerald-600" : "text-amber-600"
                }`}
              />
              <span>{hasApiKey ? "BYOK Active" : "Set AI Key"}</span>
            </button>

            {/* Quick Command Palette Button */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200/90 bg-gray-50/70 px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-700 shadow-2xs transition-all duration-200 hover:border-blue-300 hover:bg-white hover:shadow-xs active:scale-95"
            >
              <Search size={16} className="text-gray-400" />
              <span className="hidden md:inline font-medium text-gray-600">Search</span>
              <kbd className="hidden rounded-md border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-gray-400 md:inline shadow-2xs">
                {shortcut}
              </kbd>
            </button>

            {/* Bell Notification Direct Trigger */}
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

            {/* Profile Avatar & Dropdown */}
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

      {/* BYOK AI Settings Modal */}
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

      {/* Toast Notifications */}
      <ToastStack toasts={toasts} />

      {/* Notifications Drawer */}
      <NotificationsDrawer 
        open={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)}
        onCountChange={setUnreadCount}
      />
    </>
  );
}