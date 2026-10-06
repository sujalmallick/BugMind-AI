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
  system: { icon: Bell, tone: "bg-signal-soft text-signal" },
  alert: { icon: ShieldAlert, tone: "bg-flagged-soft text-flagged" },
  mention: { icon: Sparkles, tone: "bg-ochre-soft text-ochre" },
  invite: { icon: UserPlus, tone: "bg-verified-soft text-verified" },
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
      <div
        className="fixed inset-0 z-50 bg-ink/20 notif-backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-title"
        className="glass notif-drawer-enter fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col overflow-hidden sm:inset-y-2 sm:right-2 sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <h2 id="notif-title" className="text-[15px] font-semibold text-ink">Notifications</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <CheckCheck size={14} aria-hidden="true" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-1 p-3" aria-busy="true" aria-label="Loading notifications">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 rounded-xl p-3">
                  <div className="notif-skeleton h-8 w-8 shrink-0" />
                  <div className="flex flex-1 flex-col gap-2 pt-1">
                    <div className="notif-skeleton h-3 w-3/4" />
                    <div className="notif-skeleton h-2.5 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-surface text-muted">
                <BellOff size={18} aria-hidden="true" />
              </div>
              <p className="text-[14px] font-medium text-ink">No notifications</p>
              <p className="mt-1 max-w-[220px] text-[13px] leading-relaxed text-muted">
                We'll let you know when something needs your attention.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-2">
              {unread.length > 0 && (
                <>
                  <p className="eyebrow px-3 pb-1 pt-2">New</p>
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

              {read.length > 0 && (
                <>
                  <p className="eyebrow px-3 pb-1 pt-4">Earlier</p>
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
        {(notifications.length > 0 || import.meta.env.DEV) && (
          <div className="flex gap-2 border-t border-hairline px-4 py-3">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearing}
                className="btn-secondary flex-1 hover:!border-flagged/30 hover:!bg-flagged-soft hover:!text-flagged"
              >
                {clearing ? <Loader2 size={13} className="spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
                Clear all
              </button>
            )}
            {import.meta.env.DEV && (
              <button type="button" onClick={handleTest} className="btn-secondary flex-1">
                <Zap size={13} className="text-ochre" aria-hidden="true" />
                Test notification
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function NotificationCard({ notif, index, isExiting, isRippling, onMarkRead, onDelete }) {
  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  const Icon = config.icon;

  return (
    <div
      className={`group relative flex gap-3 rounded-xl p-3 transition-colors duration-200 notif-card-enter hover:bg-ink/[0.03]
        ${isExiting ? "notif-card-exit" : ""}
        ${isRippling ? "notif-read-ripple" : ""}
      `}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.tone}`}>
        <Icon size={15} aria-hidden="true" />
        {!notif.is_read && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-signal ring-2 ring-surface" aria-label="Unread" />
        )}
      </div>

      <div className="min-w-0 flex-1 pr-7">
        <p className={`text-[13px] leading-snug ${notif.is_read ? "text-muted" : "font-medium text-ink"}`}>
          {notif.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
          {notif.message}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[11px] text-muted/80">
            {formatRelativeTime(notif.created_at)}
          </span>
          {!notif.is_read && (
            <button
              type="button"
              onClick={() => onMarkRead(notif.id)}
              className="flex items-center gap-1 text-[12px] font-medium text-signal hover:text-signal-strong"
            >
              <CheckCheck size={12} aria-hidden="true" /> Mark read
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDelete(notif.id)}
        aria-label="Delete notification"
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-all duration-150 hover:bg-flagged-soft hover:text-flagged focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
