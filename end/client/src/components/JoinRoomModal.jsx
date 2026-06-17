// client/src/components/JoinRoomModal.jsx
import React, { useState } from "react";
import { X } from "lucide-react";

export default function JoinRoomModal({ open, onClose, onJoin, selectedRoom }) {
  const [code, setCode] = useState(selectedRoom?.code || "");
  const [password, setPassword] = useState("");

  // Update code when selectedRoom changes
  React.useEffect(() => {
    setCode(selectedRoom?.code || "");
    setPassword(""); // Reset password when room changes
  }, [selectedRoom]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-fadeIn">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            {selectedRoom ? `Join ${selectedRoom.code}` : "Join a Room"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {selectedRoom && (
          <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              🔒 This is a private room. Please enter the password to join.
            </p>
          </div>
        )}

        <input
          type="text"
          placeholder="Enter room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={selectedRoom ? true : false}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-3 ${
            selectedRoom ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
        />

        <input
          type="password"
          placeholder={selectedRoom ? "Enter room password" : "Room password (if any)"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
          autoFocus={selectedRoom ? true : false}
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => {
              if (code.trim()) {
                onJoin(code.trim(), password);
                setCode("");
                setPassword("");
              }
            }}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {selectedRoom ? "Join Room" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}
