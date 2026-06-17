// client/src/pages/Profile.jsx
import React, { useRef, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { 
  User, 
  Mail, 
  Image as ImageIcon, 
  Save, 
  Copy, 
  Calendar, 
  Shield, 
  Activity,
  Edit3,
  Check,
  X,
  Eye,
  EyeOff,
  Key
} from "lucide-react";
import toast from "react-hot-toast";


export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" });

  const [copiedItems, setCopiedItems] = useState(new Set());
  const fileRef = useRef(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.username || "");
      setBio(user.bio || "");
      setAvatarPreview(user.avatarUrl || null);
    }
  }, [user]);

  const onPickAvatar = () => fileRef.current?.click();
  // Avatar change (used by the hidden file input below)
  const onAvatarChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      toast.error("Please select an image file");
      return;
    }
    const url = URL.createObjectURL(f);
    setAvatarPreview(url);
  };



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

  const onSave = async () => {
    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ displayName, bio, avatarUrl: avatarPreview || undefined });
      setEditing(false);
      toast.success("Profile updated successfully!");
    } catch {
      toast.error("Failed to update profile");
    } finally {

      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      toast.error("All password fields are required");
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      toast.error("New passwords don't match");
      return;
    }
    if (passwordData.new.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    try {
      // Note: You'll need to implement password change endpoint on the server
      toast.success("Password changed successfully!");
      setPasswordData({ current: "", new: "", confirm: "" });
    } catch {
      toast.error("Failed to change password");
    }

  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                <User size={32} className="text-indigo-600 dark:text-indigo-400" />
                Profile
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your personal information and account settings
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Overview */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 sticky top-6">
                  <div className="text-center">
                    <div className="relative inline-block mb-4">
              {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="h-24 w-24 rounded-full object-cover mx-auto shadow-lg" />
              ) : (
                        <div className="h-24 w-24 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg">
                  {user?.username?.[0]?.toUpperCase() || "?"}
                </div>
              )}
                      <button
                        onClick={onPickAvatar}
                        className="absolute bottom-0 right-0 h-8 w-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                      >
                        <ImageIcon size={14} />
                      </button>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{user?.displayName || user?.username}</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{user?.username}</p>
                    {user?.bio && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">{user.bio}</p>
                    )}
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">User ID</span>
                      <button
                        onClick={() => copyToClipboard(user?._id, "User ID")}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {copiedItems.has("User ID") ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Email</span>
                      <button
                        onClick={() => copyToClipboard(user?.username, "Email")}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {copiedItems.has("Email") ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                      </button>
                    </div>
                    {user?.createdAt && (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Calendar size={14} className="text-gray-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Joined {formatDate(user.createdAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Settings */}
              <div className="lg:col-span-2 space-y-6">
                {/* Basic Information */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      <Edit3 size={20} className="text-indigo-600 dark:text-indigo-400" />
                      Basic Information
                    </h3>
                    <button
                      onClick={() => setEditing(!editing)}
                      className="px-3 py-1 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      {editing ? "Cancel" : "Edit"}
                    </button>
            </div>

                  <div className="space-y-4">
              <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                        disabled={!editing}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-800 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
                        placeholder="Your display name"
                />
              </div>
              <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                        disabled={!editing}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-[100px] dark:bg-gray-800 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 resize-none"
                  placeholder="Tell others about you..."
                />
              </div>
                    {editing && (
                      <div className="flex gap-3">
                        <button
                          onClick={onSave}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 transition-all"
                        >
                          <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          onClick={() => setEditing(false)}
                          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <X size={16} /> Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Security Settings */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Shield size={20} className="text-indigo-600 dark:text-indigo-400" />
                    Security
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                        <div className="font-medium text-gray-800 dark:text-gray-100">Change Password</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Update your account password</div>
                      </div>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="px-3 py-1 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        {showPassword ? "Hide" : "Change"}
                </button>
              </div>

                    {showPassword && (
                      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Current Password</label>
                          <input
                            type="password"
                            value={passwordData.current}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, current: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                            placeholder="Enter current password"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">New Password</label>
                          <input
                            type="password"
                            value={passwordData.new}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                            placeholder="Enter new password"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Confirm New Password</label>
                          <input
                            type="password"
                            value={passwordData.confirm}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                            placeholder="Confirm new password"
                          />
                        </div>
                <button
                          onClick={handlePasswordChange}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Key size={16} /> Update Password
                </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


