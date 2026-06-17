// client/src/pages/Landing.jsx
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#6366f1_0%,_#7c3aed_35%,_#111827_100%)] px-6 dark:bg-[radial-gradient(circle_at_top,_#111827_0%,_#1f2937_45%,_#020617_100%)]">
      <div className="text-center text-white max-w-4xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        {/* Logo */}
        <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-lg">
          ⚡ ChatBox
        </h1>
        <p className="mt-4 text-lg text-indigo-100 max-w-2xl mx-auto">
          Secure, real-time, end-to-end encrypted chatrooms.  
          Connect instantly with friends or strangers.
        </p>

        {/* Feature Pills */}
        <div className="mt-8 flex flex-wrap gap-3 justify-center text-sm text-indigo-100">
          {['Encrypted rooms','Fast matching','Image sharing','Modern UI'].map((item) => (
            <span key={item} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 shadow-sm">{item}</span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            to="/login"
            className="px-6 py-3 rounded-lg bg-white text-indigo-600 font-semibold shadow-md hover:bg-gray-100 transition dark:bg-gray-900 dark:text-indigo-300 dark:hover:bg-gray-800"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="px-6 py-3 rounded-lg bg-pink-500 font-semibold shadow-md hover:bg-pink-600 transition"
          >
            Sign Up
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-12 text-sm text-indigo-200">
          Made with 💙 using React, Tailwind, and Socket.IO
        </p>
      </div>
    </div>
  );
}
