// client/src/pages/Settings.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { 
  Copy, 
  Bell, 
  Sun, 
  Moon, 
  Monitor, 
  Shield, 
  Download, 
  Trash2, 
  Settings as SettingsIcon,
  User,
  Mail,
  Check,
  X
} from "lucide-react";
import toast from "react-hot-toast";

export default function Settings() {
  const { user } = useAuth();


  const [theme, setTheme] = useState("system");
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedItems, setCopiedItems] = useState(new Set());

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "system";
    const savedNotifications = localStorage.getItem("notifications") !== "false";
    const savedSound = localStorage.getItem("soundEnabled") !== "false";
    
    setTheme(savedTheme);
    setNotifications(savedNotifications);
    setSoundEnabled(savedSound);
  }, []);

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set(prev).add(label));
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(label);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    
    const root = window.document.documentElement;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = newTheme === 'dark' || (newTheme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
    
    toast.success(`Theme changed to ${newTheme}`);
  };

  const handleNotificationsToggle = () => {
    const newValue = !notifications;
    setNotifications(newValue);
    localStorage.setItem("notifications", newValue.toString());
    
    if (newValue && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          toast.success("Notifications enabled!");
        } else {
          toast.error("Notification permission denied");
        }
      });
    } else {
      toast.success("Notifications disabled");
    }
  };

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("soundEnabled", newValue.toString());
    toast.success(`Sound ${newValue ? 'enabled' : 'disabled'}`);
  };

  const exportData = () => {
    const userData = {
      username: user?.username,
      displayName: user?.displayName,
      bio: user?.bio,
      avatarUrl: user?.avatarUrl,
      exportDate: new Date().toISOString(),
      settings: {
        theme,
        notifications,
        soundEnabled
      }
    };
    
    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbox-data-${user?.username}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Data exported successfully!");
  };

  const clearData = () => {
    if (window.confirm("Are you sure you want to clear all local data? This cannot be undone.")) {
      localStorage.clear();
      toast.success("Local data cleared!");
      window.location.reload();
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-950 dark:to-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                <SettingsIcon size={32} className="text-indigo-600 dark:text-indigo-400" />
                Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your preferences and account settings
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Account Information */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <User size={20} className="text-indigo-600 dark:text-indigo-400" />
                  Account Information
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{user?.username}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(user?.username, "Email")}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {copiedItems.has("Email") ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-600" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">User ID</label>
                      <p className="font-medium text-gray-800 dark:text-gray-100 font-mono text-sm">{user?._id}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(user?._id, "User ID")}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {copiedItems.has("User ID") ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-600" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Appearance */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Sun size={20} className="text-indigo-600 dark:text-indigo-400" />
                  Appearance
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'light', icon: Sun, label: 'Light' },
                        { value: 'dark', icon: Moon, label: 'Dark' },
                        { value: 'system', icon: Monitor, label: 'System' }
                      ].map(({ value, icon: Icon, label }) => (
                        <button
                          key={value}
                          onClick={() => handleThemeChange(value)}
                          className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                            theme === value
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <Icon size={20} className={theme === value ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400'} />
                          <span className={`text-sm font-medium ${theme === value ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Bell size={20} className="text-indigo-600 dark:text-indigo-400" />
                  Notifications
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <label className="font-medium text-gray-800 dark:text-gray-100">Push Notifications</label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Receive notifications for new messages</p>
                    </div>
                    <button
                      onClick={handleNotificationsToggle}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        notifications ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <label className="font-medium text-gray-800 dark:text-gray-100">Sound Effects</label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Play sounds for notifications</p>
                    </div>
                    <button
                      onClick={handleSoundToggle}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        soundEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          soundEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Management */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-indigo-600 dark:text-indigo-400" />
                  Data Management
                </h2>
                <div className="space-y-4">
                  <button
                    onClick={exportData}
                    className="w-full flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                  >
                    <Download size={20} className="text-green-600 dark:text-green-400" />
                    <div className="text-left">
                      <div className="font-medium text-green-800 dark:text-green-200">Export Data</div>
                      <div className="text-sm text-green-600 dark:text-green-400">Download your account data</div>
                    </div>
                  </button>
                  <button
                    onClick={clearData}
                    className="w-full flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} className="text-red-600 dark:text-red-400" />
                    <div className="text-left">
                      <div className="font-medium text-red-800 dark:text-red-200">Clear Local Data</div>
                      <div className="text-sm text-red-600 dark:text-red-400">Remove all local storage data</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
