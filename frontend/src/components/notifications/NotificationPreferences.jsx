import React, { useState, useEffect } from 'react';
import { getPreferences, updatePreference } from '../../services/notificationService';

const NotificationPreferences = () => {
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const data = await getPreferences();
      setPreferences(data);
    } catch (error) {
      console.error('Failed to fetch preferences', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (typeStr, currentEnabled) => {
    const newEnabled = !currentEnabled;
    try {
      // Optimistic update
      setPreferences(prev => prev.map(p => p.type === typeStr ? { ...p, enabled: newEnabled } : p));
      await updatePreference(typeStr, { enabled: newEnabled });
    } catch (error) {
      console.error('Failed to update preference', error);
      // Revert on error
      setPreferences(prev => prev.map(p => p.type === typeStr ? { ...p, enabled: currentEnabled } : p));
    }
  };

  if (loading) return <div className="signal-card p-5 text-sm text-muted sm:p-7" role="status">Loading preferences…</div>;

  return (
    <section className="signal-card p-5 sm:p-7">
      <h2 className="mb-1 text-lg font-semibold text-ink">Notifications</h2>
      <p className="mb-5 text-[13px] text-muted">Choose which events send you an in-app notification.</p>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {preferences.map((pref) => {
          const label = pref.type.replace(/_/g, ' ');
          const id = `notif-pref-${pref.type}`;
          return (
            <li key={pref.type} className="flex items-center justify-between gap-6 py-4">
              <div className="min-w-0">
                <label htmlFor={id} className="block cursor-pointer text-[14px] font-medium capitalize text-ink">
                  {label}
                </label>
                <p className="mt-0.5 text-[13px] text-muted">
                  Notify me when a new {label} occurs.
                </p>
              </div>
              <span className="relative inline-flex shrink-0 items-center">
                <input
                  id={id}
                  type="checkbox"
                  role="switch"
                  aria-checked={pref.enabled}
                  className="peer sr-only"
                  checked={pref.enabled}
                  onChange={() => handleToggle(pref.type, pref.enabled)}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none h-6 w-11 rounded-full bg-hairline-strong transition-colors duration-200 peer-checked:bg-signal peer-focus-visible:shadow-[var(--ring-focus)] after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 after:content-[''] peer-checked:after:translate-x-5"
                />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default NotificationPreferences;
