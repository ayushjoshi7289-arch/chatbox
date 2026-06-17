// client/src/components/Sidebar.jsx
import React from "react";
import { Home, MessageSquare, Settings, LogOut, Users, User as UserIcon, Calendar } from "lucide-react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../context/useAuth";


export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <aside className="hidden w-72 bg-white/90 backdrop-blur-xl shadow-xl border-r border-gray-200/80 lg:flex lg:flex-col dark:bg-gray-950/95 dark:border-gray-800">
      <div className="p-6 border-b border-gray-200/80 dark:border-gray-800/80">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 text-white flex items-center justify-center text-xl shadow-lg">⚡</div>
          <div>
            <h1 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-300">ChatBox</h1>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Secure • Fast • Modern</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <div className="mb-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-3 text-white shadow-lg">
          <p className="text-[11px] uppercase tracking-[0.25em] text-indigo-100">Today</p>
          <p className="text-sm font-semibold mt-1">Stay connected with a smoother chat flow.</p>
        </div>
        <Link to="/dashboard" aria-current={isActive('/dashboard') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${isActive('/dashboard') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
          <Home size={18} /> Dashboard
        </Link>

        <Link to="/chat/general" aria-current={isActive('/chat') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${isActive('/chat') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
          <MessageSquare size={18} /> General Chat
        </Link>

        <Link to="/friends" aria-current={isActive('/friends') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${isActive('/friends') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
          <Users size={18} /> Friends
        </Link>

        <Link to="/settings" aria-current={isActive('/settings') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${isActive('/settings') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
          <Settings size={18} /> Settings
        </Link>

        <Link to="/office/meetings" aria-current={isActive('/office/meetings') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${isActive('/office/meetings') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
          <Calendar size={18} /> Office Meetings
        </Link>


        <Link to="/profile" aria-current={isActive('/profile') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${isActive('/profile') ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
          <UserIcon size={18} /> Profile
        </Link>
      </nav>

      <div className="p-4 border-t border-gray-200/80 dark:border-gray-800/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
            {user?.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <div className="text-sm font-medium dark:text-gray-100">{user?.username || "Guest"}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Online</div>
          </div>
        </div>

        <button onClick={handleLogout} className="mt-4 w-full text-left px-3 py-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  );
}
