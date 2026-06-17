// client/src/components/Topbar.jsx
import React, { useEffect, useState } from "react";
import { Bell, Search, Sun, Moon, Menu, Home, MessageSquare, Users, Settings, User as UserIcon } from "lucide-react";
import useAuth from "../context/useAuth";
import { Link, useLocation } from "react-router-dom";

export default function Topbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState("system");
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "system";
    const savedNotifications = localStorage.getItem("notifications") !== "false";
    setTheme(saved);
    setNotifications(savedNotifications);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // You can implement search functionality here
      console.log("Searching for:", searchQuery);
    }
  };

  const toggleNotifications = () => {
    const newValue = !notifications;
    setNotifications(newValue);
    localStorage.setItem("notifications", newValue.toString());
    
    if (newValue && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log("Notifications enabled!");
        } else {
          console.log("Notification permission denied");
        }
      });
    }
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-8 py-4 bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-200/80 dark:bg-gray-950/90 dark:border-gray-800/80">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Menu size={20} />
        </button>
        <form onSubmit={handleSearch} className="bg-gray-100/90 rounded-full px-3 py-2 flex items-center gap-2 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800/90 dark:ring-gray-700">
          <Search size={18} className="text-gray-500 dark:text-gray-400" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms, friends..." 
            className="bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 w-32 sm:w-48 lg:w-64" 
          />
        </form>
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={toggleNotifications}
          className={`relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition ${notifications ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}
          title={notifications ? "Notifications enabled" : "Notifications disabled"}
        >
          <Bell size={20} />
          {notifications && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>}
        </button>

        <div className="flex items-center gap-2 text-sm">
          <button
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition ${theme === 'light' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}
            onClick={() => setTheme('light')}
            title="Light theme"
          >
            <Sun size={18} />
          </button>
          <button
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition ${theme === 'dark' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}
            onClick={() => setTheme('dark')}
            title="Dark theme"
          >
            <Moon size={18} />
          </button>
          <select
            aria-label="Theme selector"
            className="text-xs bg-transparent border rounded px-2 py-1 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-white flex items-center justify-center font-bold shadow-lg ring-2 ring-white dark:ring-gray-900">
            {user?.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.username || "Guest"}</div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-lg z-50">
          <nav className="flex flex-col py-2">
            <Link 
              to="/dashboard" 
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 transition ${isActive('/dashboard') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            >
              <Home size={18} /> Dashboard
            </Link>
            <Link 
              to="/chat/general" 
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 transition ${isActive('/chat') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            >
              <MessageSquare size={18} /> General Chat
            </Link>
            <Link 
              to="/friends" 
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 transition ${isActive('/friends') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            >
              <Users size={18} /> Friends
            </Link>
            <Link 
              to="/settings" 
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 transition ${isActive('/settings') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            >
              <Settings size={18} /> Settings
            </Link>
            <Link 
              to="/profile" 
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 transition ${isActive('/profile') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            >
              <UserIcon size={18} /> Profile
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
