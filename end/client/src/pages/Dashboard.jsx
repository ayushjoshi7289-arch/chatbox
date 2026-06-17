// client/src/pages/Dashboard.jsx
import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import api from "../api";
import { Users, Zap, PlusCircle, RefreshCw, Copy, LogIn } from "lucide-react";
import toast from "react-hot-toast";
import JoinRoomModal from "../components/JoinRoomModal";

const socket = io(import.meta.env.VITE_API_URL || "http://localhost:3000",/*"http://10.237.224.218:3000",*/ { withCredentials: true });

const MATCH_CATEGORIES = [
  { key: "duo", label: "Duo", description: "2 people" },
  { key: "group", label: "Group", description: "3–5 people" },
  { key: "party", label: "Party", description: "casual hangout" },
];

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();


  const [rooms, setRooms] = useState([]);
  const [matching, setMatching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("duo");
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get("/api/rooms");
      if (res.data?.success) setRooms(res.data.rooms);
} catch {
      toast.error("Failed to fetch rooms");
    }



  }, []);


  useEffect(() => {
    fetchRooms();

    socket.on("roomsUpdated", fetchRooms);
    socket.on("match-found", ({ roomId, category, participants }) => {
      setMatching(false);
      toast.success(`🎉 Match found in ${category || "duo"} chat with ${participants?.join(", ") || "friends"}`);
      navigate(`/chat/${roomId}`);
    });
    socket.on("waiting-for-match", ({ category }) => {
      toast(`⏳ Looking for a ${category || "duo"} match...`, { icon: "🕒" });
    });

    return () => {
      socket.off("roomsUpdated", fetchRooms);
      socket.off("match-found");
      socket.off("waiting-for-match");
    };
  }, [fetchRooms, navigate]);

  const quickMatch = () => {
    if (!user?.username) {
      toast.error("Please login to use Quick Match");
      return;
    }
    setMatching(true);
    socket.emit("quick-match", { username: user.username, category: selectedCategory });
  };

  const createRoom = async () => {
    const code = `ROOM-${Math.floor(Math.random() * 9000) + 1000}`;
    const password = prompt("Set a password (optional, leave empty for public room):") || "";
    const modeInput = prompt("Room type: enter 'professional' or 'casual'", "casual") || "casual";
    const mode = String(modeInput).toLowerCase() === 'professional' ? 'professional' : 'casual';

    try {
      await api.post("/api/rooms", { code, password, mode });
      navigate(`/chat/${code}`);
    } catch {
      toast.error("Create room failed");
    }

  };


  const handleJoinRoom = async (code, password) => {
    try {
      const res = await api.post("/api/rooms/verify", { code, password });
      if (res.data?.success) {
        setJoinModalOpen(false);
        navigate(`/chat/${code}`);
      } else {
        toast.error("Wrong password!");
      }
    } catch (err) {
      toast.error("Failed to join room");
    }
  };

  const handleDirectJoin = async (roomCode) => {
    try {
      // For public rooms, join directly without password verification
      setJoinModalOpen(false);
      toast.success(`🎉 Joining ${roomCode}!`);
      navigate(`/chat/${roomCode}`);
    } catch (err) {
      toast.error("Failed to join room");
    }
  };

  const handleJoinClick = (room) => {
    if (room.hasPassword) {
      // Private room - open modal to ask for password
      setJoinModalOpen(true);
      // Store the room code for the modal
      setSelectedRoom(room);
    } else {
      // Public room - join directly
      handleDirectJoin(room.code);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-950 dark:to-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-0">
        <Topbar />
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-300">Overview</p>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">Welcome, <span className="text-indigo-600 dark:text-indigo-400">{user?.username}</span></h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Jump into a room, start a quick match, or keep your chats organized.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/80 p-1 shadow-sm border border-gray-200/80 dark:bg-gray-900/90 dark:border-gray-800">
                {MATCH_CATEGORIES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedCategory(item.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      selectedCategory === item.key
                        ? "bg-indigo-600 text-white shadow"
                        : "text-gray-700 hover:bg-indigo-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    {item.label}
                    <span className="ml-1 text-[11px] opacity-80">{item.description}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={quickMatch}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white shadow transition active:scale-[0.98] ${
                  matching ? "bg-yellow-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                <Zap size={18} />
                {matching ? "Matching..." : "Quick Match"}
              </button>

              <button
                onClick={createRoom}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition active:scale-[0.98]"
              >
                <PlusCircle size={18} />
                Create Room
              </button>

              <button
                onClick={() => setJoinModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2 bg-gray-800 text-white rounded-lg shadow hover:bg-gray-900 transition active:scale-[0.98]"
              >
                <LogIn size={18} />
                Join Room
              </button>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-3 mb-6">
            {[
              {label:'Active rooms', value: rooms.length || 0, tone:'from-indigo-500 to-violet-500'},
              {label:'Quick actions', value:'3', tone:'from-emerald-500 to-green-500'},
              {label:'Online status', value:'Live', tone:'from-pink-500 to-rose-500'},
            ].map((item) => (
              <article key={item.label} className="rounded-3xl bg-white/90 p-5 shadow-lg border border-gray-200/80 dark:bg-gray-900/90 dark:border-gray-800">
                <div className={`h-2 w-20 rounded-full bg-gradient-to-r ${item.tone} mb-3`} />
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{item.value}</p>
              </article>
            ))}
          </section>

          {/* Rooms */}
          <section className="bg-white/90 p-5 rounded-3xl shadow-xl border border-gray-200/80 dark:bg-gray-900/90 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                Active Rooms
              </h2>
              <button
                onClick={fetchRooms}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div className="space-y-3">
              {rooms.length ? (
                rooms.map((r) => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 transition dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">{r.code}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {r.hasPassword ? "🔒 Private" : "🌐 Public"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(r.code);
                          toast.success("Room code copied");
                        }}
                        className="flex items-center gap-1 text-sm px-3 py-1 border rounded hover:bg-gray-200 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <Copy size={14} /> Copy
                      </button>
                      <button
                        onClick={() => handleJoinClick(r)}
                        className={`flex items-center gap-1 text-sm px-3 py-1 text-white rounded hover:opacity-90 ${
                          r.hasPassword 
                            ? "bg-orange-600 hover:bg-orange-700" 
                            : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                        title={r.hasPassword ? "Private room - requires password" : "Public room - join directly"}
                      >
                        <LogIn size={14} /> {r.hasPassword ? "🔒 Join" : "Join"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-3" aria-busy="true" aria-live="polite">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl dark:bg-gray-800">
                      <div className="space-y-2">
                        <div className="h-4 w-40 bg-gray-200 rounded dark:bg-gray-700 animate-pulse" />
                        <div className="h-3 w-24 bg-gray-200 rounded dark:bg-gray-700 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-16 bg-gray-200 rounded dark:bg-gray-700 animate-pulse" />
                        <div className="h-8 w-16 bg-gray-200 rounded dark:bg-gray-700 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

        <JoinRoomModal
          open={joinModalOpen}
          onClose={() => {
            setJoinModalOpen(false);
            setSelectedRoom(null);
          }}
          onJoin={handleJoinRoom}
          selectedRoom={selectedRoom}
        />
    </div>
  );
}
