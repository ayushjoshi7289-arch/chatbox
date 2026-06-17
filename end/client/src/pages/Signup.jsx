// client/src/pages/Signup.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../context/useAuth";
import { UserPlus, Eye, EyeOff, BadgeCheck } from "lucide-react";
import toast from "react-hot-toast";

const usernamePattern = /^[A-Za-z0-9_-]{3,20}$/;

const getPasswordStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score === 3 || score === 4) return { score, label: "Good", color: "bg-amber-400" };
  return { score, label: "Strong", color: "bg-emerald-500" };
};

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", displayName: "", password: "", confirmPassword: "", profileType: "both" });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = getPasswordStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const username = form.username.trim();
    const displayName = form.displayName.trim();

    if (!username || !form.password || !form.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!usernamePattern.test(username)) {
      toast.error("Use 3–20 letters, numbers, underscores, or hyphens for your username");
      return;
    }

    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await signup({
        username,
        displayName: displayName || username,
        password: form.password,
        profileType: form.profileType,
      });

      toast.success("🎉 Account created successfully!");
      navigate("/dashboard");
    } catch (err) {
      console.error("Signup error:", err);
      const errorMessage = err.response?.data?.message || "Signup failed";
      toast.error(errorMessage + " ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden">
      {/* Colorful Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 animate-gradient dark:from-gray-950 dark:via-gray-900 dark:to-gray-800" />

      {/* Floating blobs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-20 -left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      {/* Card */}
      <div className="relative bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl p-10 w-full max-w-md dark:bg-gray-900/80">
        <h1 className="text-4xl font-extrabold text-center text-pink-600 mb-2 drop-shadow dark:text-pink-400">
          🎨 Create Account
        </h1>
        <p className="text-center text-gray-600 mb-6 dark:text-gray-300">Join the fun and start chatting ✨</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 block">Account type</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ value: "casual", label: "Casual" }, { value: "office", label: "Office" }, { value: "both", label: "Both" }].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, profileType: value }))}
                  className={`px-3 py-2 rounded-full border shadow-md text-sm transition outline-none ${
                    form.profileType === value
                      ? "bg-pink-500 text-white border-pink-500"
                      : "bg-white/90 border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Username</label>
            <input
              type="text"
              placeholder="Choose a unique username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              className="w-full px-4 py-3 border rounded-full focus:ring-4 focus:ring-yellow-400 outline-none shadow-md text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Display name <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              placeholder="How should people see you?"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full px-4 py-3 border rounded-full focus:ring-4 focus:ring-pink-400 outline-none shadow-md text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="🔑 Password (min 8 chars)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              className="w-full px-4 py-3 pr-12 border rounded-full focus:ring-4 focus:ring-pink-400 outline-none shadow-md text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="🔁 Confirm password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
              className="w-full px-4 py-3 border rounded-full focus:ring-4 focus:ring-pink-400 outline-none shadow-md text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
          </div>

          {form.password && (
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center justify-between">
                <span>Password strength</span>
                <span className="font-semibold">{passwordStrength.label}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className={`h-full ${passwordStrength.color}`} style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
              </div>
              <p>Tip: use 8+ characters with upper/lower case, numbers, and symbols for a stronger account.</p>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><BadgeCheck size={14} /> Usernames are your chat handle and stay visible to friends.</p>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold rounded-full shadow-lg active:scale-[0.98] transition"
          >
            <UserPlus size={20} />
            {loading ? "Creating..." : "Sign Me Up 🎉"}
          </button>
        </form>

        <p className="text-sm text-gray-700 mt-6 text-center dark:text-gray-300">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-600 font-bold underline">
            Login Here 🚪
          </Link>
        </p>
      </div>
    </div>
  );
}
