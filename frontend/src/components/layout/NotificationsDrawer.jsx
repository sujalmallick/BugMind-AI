import { useState, useEffect, useRef } from "react";
import { X, CheckCheck, Bell, BellOff, Trash2, ShieldAlert, Sparkles, UserPlus, Loader2, Zap } from "lucide-react";
import { formatRelativeTime } from "../../utils/time";
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  triggerTestNotification,
  clearAllNotifications
} from "../../services/notificationService";

const TYPE_CONFIG = {
  system: {
    icon: Bell,
    gradient: "from-blue-500 to-indigo-600",
    shadow: "shadow-blue-500/30",
  },
  alert: {
    icon: ShieldAlert,
    gradient: "from-orange-500 to-red-500",
    shadow: "shadow-orange-500/30",
  },
  mention: {
    icon: Sparkles,
    gradient: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/30",
  },
  invite: {
    icon: UserPlus,
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/30",
  },
};

export default function NotificationsDrawer({ open, onClose, onCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [exitingIds, setExitingIds] = useState(new Set());
  const [rippleId, setRippleId] = useState(null);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  function notifyCount(list) {
    if (onCountChange) onCountChange(list.filter(n => !n.is_read).length);
  }

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      const list = Array.isArray(data) ? data : (data?.items ?? []);
      setNotifications(list);
      notifyCount(list);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsRead(id) {
    setRippleId(id);
    setTimeout(() => setRippleId(null), 650);
    try {
      await markAsRead(id);
      const updated = notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
      setNotifications(updated);
      notifyCount(updated);
    } catch (error) {
      console.error("Failed to mark read", error);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await markAllAsRead();
      const updated = notifications.map(n => ({ ...n, is_read: true }));
      setNotifications(updated);
      notifyCount(updated);
    } catch (error) {
      console.error("Failed to mark all read", error);
    }
  }

  function handleDelete(id) {
    // Trigger exit animation first, then remove
    setExitingIds(prev => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await deleteNotification(id);
        const updated = notifications.filter(n => n.id !== id);
        setNotifications(updated);
        notifyCount(updated);
        setExitingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      } catch (error) {
        console.error("Failed to delete notification", error);
        setExitingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      }
    }, 370);
  }

  async function handleClearAll() {
    // Animate all out first
    const allIds = notifications.map(n => n.id);
    setExitingIds(new Set(allIds));
    setTimeout(async () => {
      setClearing(true);
      try {
        await clearAllNotifications();
        setNotifications([]);
        notifyCount([]);
        setExitingIds(new Set());
      } catch (error) {
        console.error("Failed to clear notifications", error);
        setExitingIds(new Set());
      } finally {
        setClearing(false);
      }
    }, 400);
  }

  async function handleTest() {
    try {
      await triggerTestNotification();
      loadNotifications();
    } catch (error) {
      console.error("Failed to trigger test", error);
    }
  }

  if (!open) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const unread = notifications.filter(n => !n.is_read);
  const read = notifications.filter(n => n.is_read);

  return (
    <>
      {/* Animated backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] notif-backdrop-enter"
        onClick={onClose}
      />

      {/* Drawer — spring slide-in */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] flex flex-col bg-white shadow-2xl overflow-hidden notif-drawer-enter">

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          {/* Gradient bar that sweeps in */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 gradient-bar-enter" />

          <div className="flex items-center gap-3">
            {/* Icon with pulsing unread ring */}
            <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/30 ${unreadCount > 0 ? 'unread-pulse' : ''}`}>
              <Bell size={17} className="text-white" />
              {unreadCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] flex items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white badge-pop">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Notifications</h2>
              <p className="text-[11px] text-gray-400 font-medium transition-all duration-300">
                {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : "You're all caught up ✓"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 transition-all duration-150 active:scale-95"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all duration-150 active:scale-90"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/40">
          {loading ? (
            /* Skeleton shimmer cards */
            <div className="p-3 flex flex-col gap-2 mt-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-gray-100 p-4 flex gap-3" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="notif-skeleton h-9 w-9 rounded-xl shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 pt-1">
                    <div className="notif-skeleton h-3 w-3/4 rounded" />
                    <div className="notif-skeleton h-2.5 w-full rounded" />
                    <div className="notif-skeleton h-2.5 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            /* Animated empty state */
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-5 shadow-inner bell-float">
                <BellOff size={30} className="text-gray-400" />
              </div>
              <p className="text-[16px] font-bold text-gray-700">Nothing here yet</p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-[200px]">
                We'll notify you when something important happens.
              </p>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {/* Unread section */}
              {unread.length > 0 && (
                <>
                  <p className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400 section-label-enter">
                    ● New
                  </p>
                  {unread.map((notif, i) => (
                    <NotificationCard
                      key={notif.id}
                      notif={notif}
                      index={i}
                      isExiting={exitingIds.has(notif.id)}
                      isRippling={rippleId === notif.id}
                      onMarkRead={handleMarkAsRead}
                      onDelete={handleDelete}
                    />
                  ))}
                </>
              )}

              {/* Read section */}
              {read.length > 0 && (
                <>
                  <p className="px-2 pt-3 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-300 section-label-enter">
                    Earlier
                  </p>
                  {read.map((notif, i) => (
                    <NotificationCard
                      key={notif.id}
                      notif={notif}
                      index={unread.length + i}
                      isExiting={exitingIds.has(notif.id)}
                      isRippling={false}
                      onMarkRead={handleMarkAsRead}
                      onDelete={handleDelete}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-2">
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 text-red-500 text-[12px] font-semibold transition-all border border-red-100 disabled:opacity-50"
            >
              {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Clear all
            </button>
          )}
          <button
            onClick={handleTest}
            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 active:scale-95 text-gray-600 text-[12px] font-semibold transition-all border border-gray-200"
          >
            <Zap size={12} className="text-yellow-500" />
            Test notification
          </button>
        </div>

      </div>
    </>
  );
}

function NotificationCard({ notif, index, isExiting, isRippling, onMarkRead, onDelete }) {
  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  const Icon = config.icon;

  return (
    <div
      className={`group relative flex gap-3 rounded-2xl p-4 transition-all duration-200 border
        notif-card-enter
        ${isExiting ? 'notif-card-exit' : ''}
        ${isRippling ? 'notif-read-ripple' : ''}
        ${notif.is_read
          ? "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
          : "bg-white border-indigo-100 shadow-sm shadow-indigo-500/5 hover:shadow-md hover:shadow-indigo-500/8"
        }
      `}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      {/* Unread left stripe */}
      {!notif.is_read && (
        <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-500" />
      )}

      {/* Icon */}
      <div className={`shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-sm ${config.shadow}`}>
        <Icon size={15} className="text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-7">
        <p className={`text-[13px] leading-snug ${notif.is_read ? "font-medium text-gray-500" : "font-semibold text-gray-900"}`}>
          {notif.title}
        </p>
        <p className="text-[12px] text-gray-400 mt-1 leading-relaxed line-clamp-2">
          {notif.message}
        </p>
        <div className="flex items-center gap-3 mt-2.5">
          <span className="text-[10px] font-medium text-gray-300">
            {formatRelativeTime(notif.created_at)}
          </span>
          {!notif.is_read && (
            <button
              onClick={() => onMarkRead(notif.id)}
              className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-all active:scale-95"
            >
              <CheckCheck size={11} /> Mark read
            </button>
          )}
        </div>
      </div>

      {/* Delete — fades in on hover */}
      <button
        onClick={() => onDelete(notif.id)}
        className="absolute right-3 top-3 h-6 w-6 flex items-center justify-center rounded-lg text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-400 transition-all duration-150 active:scale-90"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
