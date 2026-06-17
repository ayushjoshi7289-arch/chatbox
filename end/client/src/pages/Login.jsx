// client/src/pages/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { LogIn, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.username.trim() || !form.password) {
      toast.error("Please fill in your username and password");
      return;
    }
    
    setLoading(true);
    try {
      await login({ username: form.username.trim(), password: form.password });
      toast.success("🎉 Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage = err.response?.data?.message || "Invalid credentials";
      toast.error(errorMessage + " ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden">
      {/* Colorful Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600 animate-gradient dark:from-gray-950 dark:via-gray-900 dark:to-gray-800" />

      {/* Floating blobs */}
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-yellow-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute top-40 -left-10 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      {/* Card */}
      <div className="relative bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl p-10 w-full max-w-md dark:bg-gray-900/80">
        <h1 className="text-4xl font-extrabold text-center text-indigo-700 mb-2 drop-shadow dark:text-indigo-400">
          👋 Welcome Back!
        </h1>
        <p className="text-center text-gray-600 mb-6 dark:text-gray-300">Use your username to jump back into the fun 🎮</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="text"
            placeholder="👤 Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            className="w-full px-4 py-3 border rounded-full focus:ring-4 focus:ring-pink-400 outline-none shadow-md text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="🔑 Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full px-4 py-3 pr-12 border rounded-full focus:ring-4 focus:ring-purple-400 outline-none shadow-md text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-full shadow-lg active:scale-[0.98] transition"
          >
            <LogIn size={20} />
            {loading ? "Logging in..." : "Let’s Go 🚀"}
          </button>
        </form>

        <p className="text-sm text-gray-700 mt-6 text-center dark:text-gray-300">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-pink-600 font-bold underline">
            Create One 🎨
          </Link>
        </p>
      </div>
    </div>
  );
}
