import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import useAuth from "../context/useAuth";
import api from "../api";
import toast from "react-hot-toast";
import { Calendar, Users, PlusCircle, Clock3, Check, X, Shield, ArrowRight } from "lucide-react";

export default function OfficeMeetings() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [durationMins, setDurationMins] = useState(30);
  const [participants, setParticipants] = useState("" ); // comma-separated usernames


  const [saving, setSaving] = useState(false);
  const [meetings, setMeetings] = useState([]);


  const allowed = useMemo(() => {
    const allowedProfiles = user?.allowedProfiles || ["casual", "office"];
    return allowedProfiles.includes("office");
  }, [user]);

  const activeIsOffice = user?.activeProfileType === "office";

  useEffect(() => {
    if (!allowed) return;
    fetchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await api.get("/api/office/sessions/upcoming");
      if (res.data?.success) setMeetings(res.data.sessions || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load office meetings");
    }
  };

  const scheduleMeeting = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Meeting title is required");
    if (!scheduledAt) return toast.error("Scheduled date/time is required");

    const parsedParticipants = participants
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await api.post(
        "/api/office/sessions/schedule",
        {
          title,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMins: Number(durationMins) || 30,
          participants: parsedParticipants,
        }
      );


      if (res.data?.success) {
        toast.success("Meeting scheduled");
        setTitle("");
        setScheduledAt("");
        setDurationMins(30);
        setParticipants("");
        await fetchMeetings();
      } else {
        toast.error(res.data?.message || "Scheduling failed");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Scheduling failed");
    } finally {
      setSaving(false);
    }
  };

  const joinMeeting = async (id) => {
    try {
      const res = await api.post(`/api/office/sessions/${id}/join`, {}, { withCredentials: true });

      if (res.data?.success) {
        toast.success("Joined meeting");
        await fetchMeetings();
      } else {
        toast.error(res.data?.message || "Join failed");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Join failed");
    }
  };

  if (!allowed) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-950 dark:to-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 p-6">
            <div className="max-w-2xl mx-auto bg-white/90 dark:bg-gray-900/80 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Shield size={20} className="text-indigo-600" /> Office access not enabled
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-3">
                Your account was created without office access.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-950 dark:to-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                  <Calendar size={32} className="text-indigo-600 dark:text-indigo-400" />
                  Office Meetings
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Schedule and join meetings in your office context.
                </p>
              </div>
              <div className="text-xs px-3 py-2 rounded-full border bg-white/60 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800">
                Active profile: <span className="font-semibold">{user?.activeProfileType || "casual"}</span>
                {!activeIsOffice && (
                  <div className="text-yellow-600 dark:text-yellow-400 mt-1">Switch to Office in Settings for best results.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Schedule */}
              <section className="bg-white/90 dark:bg-gray-900/90 border border-gray-200/80 dark:border-gray-800 rounded-3xl p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <PlusCircle size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Schedule a meeting
                </h2>

                <form onSubmit={scheduleMeeting} className="mt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl text-sm text-gray-800 dark:text-gray-100"
                      placeholder="e.g. Weekly sync"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Scheduled at</label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl text-sm text-gray-800 dark:text-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Duration (mins)</label>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={durationMins}
                        onChange={(e) => setDurationMins(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl text-sm text-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Participants</label>
                      <input
                        value={participants}
                        onChange={(e) => setParticipants(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl text-sm text-gray-800 dark:text-gray-100"
                        placeholder="comma usernames"
                      />
                    </div>
                  </div>

                  <button
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl shadow hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    <Clock3 size={18} />
                    {saving ? "Scheduling..." : "Schedule"}
                  </button>
                </form>
              </section>

              {/* Upcoming */}
              <section className="bg-white/90 dark:bg-gray-900/90 border border-gray-200/80 dark:border-gray-800 rounded-3xl p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Upcoming meetings
                </h2>

                <div className="mt-4 space-y-3">
                  {meetings.length === 0 ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">No upcoming meetings.</div>
                  ) : (
                    meetings.map((m) => {
                      const dt = m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : "";
                      return (
                        <div key={m.id || m._id} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-800 dark:text-gray-100">{m.title}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                                <Calendar size={12} /> {dt}
                                {typeof m.durationMins !== "undefined" && (
                                  <>• {m.durationMins} mins</>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Participants: {(m.participants || []).length ? (m.participants || []).join(", ") : "(none)"}
                              </div>
                            </div>
                            <div>
                              <button
                                onClick={() => joinMeeting(m.id || m._id)}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl shadow disabled:opacity-50"
                              >
                                <ArrowRight size={14} /> Join
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={fetchMeetings}

                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Refresh

                  </button>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

