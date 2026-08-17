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

  if (loading) return <div>Loading preferences...</div>;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification Preferences</h3>
      <div className="space-y-4">
        {preferences.map((pref) => (
          <div key={pref.type} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-200 capitalize">
                {pref.type.replace('_', ' ')} Notifications
              </p>
              <p className="text-sm text-gray-500">
                Receive notifications when a new {pref.type.replace('_', ' ')} occurs.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={pref.enabled}
                onChange={() => handleToggle(pref.type, pref.enabled)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationPreferences;
