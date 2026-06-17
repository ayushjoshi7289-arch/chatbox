// client/src/pages/Friends.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import useAuth from "../context/useAuth";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { UserPlus, Check, XCircle, Search, Users as UsersIcon, Sparkles, MessageSquare, Clock3 } from "lucide-react";
import toast from "react-hot-toast";

export default function Friends() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const fetchFriends = async () => {
    try {
      const res = await api.get("/api/friends/list");
      if (res.data.success) setFriends(res.data.friends);

      const reqs = await api.get("/api/friends/requests");
      if (reqs.data.success) setRequests(reqs.data.requests);
    } catch (err) {
      console.error("Friend fetch error", err);
      toast.error("Failed to fetch friends data");
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const sendInvite = async () => {
    const username = inviteUsername.trim();
    if (!username) {
      toast.error("Please enter a username");
      return;
    }

    if (username.length < 3) {
      toast.error("Usernames should be at least 3 characters");
      return;
    }

    try {
      const res = await api.post("/api/friends/request", {
        toUsername: username,
      });
      toast.success(res.data.message || "Friend request sent!");
      setInviteUsername("");
      await fetchFriends();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Error sending invite";
      toast.error(errorMessage);
    }
  };

  const acceptRequest = async (id) => {
    try {
      await api.post("/api/friends/accept", { requestId: id });
      toast.success("Friend request accepted!");
      await fetchFriends();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Error accepting request";
      toast.error(errorMessage);
    }
  };

  const declineRequest = async (id) => {
    try {
      await api.post("/api/friends/decline", { requestId: id });
      toast.success("Friend request declined");
      await fetchFriends();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Error declining request";
      toast.error(errorMessage);
    }
  };

  const filteredFriends = friends.filter((f) => f.username?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredRequests = requests.filter((r) => r.from?.username?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-0">
        <Topbar />
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Friends", value: friends.length, icon: UsersIcon, tone: "from-indigo-500 to-violet-500" },
              { label: "Pending requests", value: requests.length, icon: Sparkles, tone: "from-emerald-500 to-green-500" },
              { label: "Searchable", value: "Live", icon: Search, tone: "from-pink-500 to-rose-500" },
            ].map((item) => (
              <article key={item.label} className="rounded-3xl bg-white/90 p-5 shadow-xl border border-gray-200/80 dark:bg-gray-900/90 dark:border-gray-800">
                <div className={`h-2 w-20 rounded-full bg-gradient-to-r ${item.tone} mb-3`} />
                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-100">
                  <item.icon size={18} className="text-indigo-600 dark:text-indigo-300" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-2">{item.value}</p>
              </article>
            ))}
          </section>

          <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-green-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-green-950/30 dark:text-emerald-100">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} /> You have {requests.length} pending request{requests.length === 1 ? "" : "s"}</div>
            <p className="text-sm text-emerald-700 dark:text-emerald-200 mt-1">Accept or decline requests here, then jump into a chat with your approved friends.</p>
          </div>

          {/* Invite Friend */}
          <div className="bg-white/90 p-6 rounded-3xl shadow-xl border border-gray-200/80 dark:bg-gray-900/90 dark:border-gray-800">
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <UserPlus size={18} /> Invite a Friend
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add people by username to grow your trusted circle.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="Enter a username"
                className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl text-sm text-gray-800 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                onClick={sendInvite}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl shadow hover:shadow-lg transition active:scale-[0.98]"
              >
                Send Invite
              </button>
            </div>
          </div>

          {/* Friend List */}
          <div className="bg-white/90 p-6 rounded-3xl shadow-xl border border-gray-200/80 dark:bg-gray-900/90 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">Friends</h2>
              <label className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 shadow-sm">
                <Search size={14} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search" className="w-32 bg-transparent outline-none placeholder:text-gray-400" />
              </label>
            </div>
            <ul className="space-y-3">
              {filteredFriends.length ? (
                filteredFriends.map((f) => (
                  <li key={f._id} className="flex items-center justify-between bg-gray-50/90 p-4 rounded-2xl border border-gray-100 dark:bg-gray-800/80 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold shadow">{f.username?.[0]?.toUpperCase() || "?"}</div>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-100">{f.username}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{f.online ? "Available for chat" : "Away"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${f.online ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                        {f.online ? "Online" : "Offline"}
                      </span>
                      <button
                        onClick={() => navigate("/chat/general")}
                        className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition active:scale-[0.98]"
                      >
                        <MessageSquare size={14} /> Start chat
                      </button>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500 italic">
                  No friends yet
                </li>
              )}
            </ul>
          </div>

          {/* Friend Requests */}
          <div className="bg-white/90 p-6 rounded-3xl shadow-xl border border-gray-200/80 dark:bg-gray-900/90 dark:border-gray-800">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-100">Friend Requests</h2>
            <ul className="space-y-3">
              {filteredRequests.length ? (
                filteredRequests.map((r) => (
                  <li key={r._id} className="flex flex-col gap-3 bg-gray-50/90 p-4 rounded-2xl border border-gray-100 dark:bg-gray-800/80 dark:border-gray-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center font-bold shadow">{r.from?.username?.[0]?.toUpperCase() || "?"}</div>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-100">{r.from?.username}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Clock3 size={12} /> Pending approval • incoming request</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptRequest(r._id)} className="inline-flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm shadow transition active:scale-[0.98]"> <Check size={14} /> Accept </button>
                      <button onClick={() => declineRequest(r._id)} className="inline-flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm shadow transition active:scale-[0.98]"> <XCircle size={14} /> Decline </button>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500 italic">
                  No pending requests
                </li>
              )}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
