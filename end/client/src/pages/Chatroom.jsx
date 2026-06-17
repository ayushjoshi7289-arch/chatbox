// client/src/pages/Chatroom.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import io from "socket.io-client";
import { ImagePlus, Send, Video, VideoOff } from "lucide-react";
import toast from "react-hot-toast";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"; //"http://10.237.224.218:3000";
const socket = io(SOCKET_URL, { withCredentials: true });




// --- helpers: base64 <-> ArrayBuffer
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}
function strToU8(s) {
  return new TextEncoder().encode(s);
}
function u8ToStr(u8) {
  return new TextDecoder().decode(u8);
}

async function sha256Digest(text) {
  const encoded = strToU8(text);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
}

// AES-GCM helpers
async function aesGcmEncryptRaw(aesKey, rawUint8, additionalData = "") {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = await sha256Digest(additionalData);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad, tagLength: 128 }, aesKey, rawUint8);
  return { iv: bufToBase64(iv), data: bufToBase64(ct) };
}
async function aesGcmDecryptRaw(aesKey, ivB64, dataB64, additionalData = "") {
  try {
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));
    const aad = await sha256Digest(additionalData);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad, tagLength: 128 }, aesKey, ct);
    return new Uint8Array(pt);
  } catch (err) {
    console.error("AES decrypt failed", err);
    return null;
  }
}

export default function ChatRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]); // { username, text, time, system }
  const [input, setInput] = useState("");
  const [members, setMembers] = useState([]); // { username, socketId, publicKey }
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("🔒 Waiting for group key...");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [videoActive, setVideoActive] = useState(false);


  // room mode/policy (server provided)
  const [roomMode, setRoomMode] = useState('casual');
  const isProfessional = roomMode === 'professional';


  const [videoDisabledByPolicy, setVideoDisabledByPolicy] = useState(false);
  const [screenShareEnabledByPolicy, setScreenShareEnabledByPolicy] = useState(false);

  const [screenSharingActive, setScreenSharingActive] = useState(false);





  const privateRsaRef = useRef(null); // RSA private key for decrypting AES keys
  const groupKeyRef = useRef(null); // AES CryptoKey
  const publicKeyMapRef = useRef({}); // username -> CryptoKey (imported RSA public keys)
  const messagesEndRef = useRef(null);
  const prevRoomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const localScreenStreamRef = useRef(null);
  
  // videoStatus/audioMutedByPolicy/screenShareStatus are currently not used in UI; keep state only if needed later.
  // (lint) 
  const [, setVideoStatus] = useState("");
  const [, setAudioMutedByPolicy] = useState(false);
  const [, setScreenShareStatus] = useState("");



  // auto scroll
  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const blockCopyAndScreenshots = useCallback((event) => {
    const copyShortcut = (event.ctrlKey || event.metaKey) && ["c", "C", "x", "X", "a", "A"].includes(event.key);
    const printShortcut = event.key === "PrintScreen" || (event.key === "p" && (event.ctrlKey || event.metaKey) && event.shiftKey);
    if (copyShortcut || printShortcut || event.key === "F12") {
      event.preventDefault();
      toast("Copying and screenshots are disabled in this room.", { icon: "🛡️" });
    }

  }, []);

  useEffect(() => {
    document.addEventListener("keydown", blockCopyAndScreenshots);
    return () => document.removeEventListener("keydown", blockCopyAndScreenshots);
  }, [blockCopyAndScreenshots]);

  // handle room switching: emit leave for previous room and reset state/crypto
  useEffect(() => {
    if (prevRoomRef.current && user?.username) {
      socket.emit("leave-room", { roomId: prevRoomRef.current, username: user.username });
    }
    // reset UI state
    setMessages([]);
    setHistoryLoaded(false);
    setMembers([]);
    setReady(false);
    setStatus(roomId === "general" ? "🌐 General chat - no encryption needed" : "🔒 Waiting for group key...");
    // reset crypto
    privateRsaRef.current = null;
    groupKeyRef.current = null;
    publicKeyMapRef.current = {};
    prevRoomRef.current = roomId;
  }, [roomId, user?.username]);

  const stopVideoCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    // stop screen share tracks if any
    try {
      screenSharingActive && localScreenStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch(err) {
    console.error(err);
    }
    screenSharingActive && setScreenSharingActive(false);



    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setVideoActive(false);

  }, [screenSharingActive]);

  // on unmount, leave current room
  useEffect(() => {
    return () => {
      if (prevRoomRef.current && user?.username) {
        socket.emit("leave-room", { roomId: prevRoomRef.current, username: user.username });
      }
      stopVideoCall();
    };
  }, [stopVideoCall, user?.username]);

  // generate RSA keypair on mount (for key-exchange) - only for private rooms
  useEffect(() => {
    let mounted = true;
    
    console.log("🔍 Client roomId from useParams():", roomId);
    console.log("🔍 Is general?", roomId === "general");
    
    // For general room, skip crypto setup and join directly
    if (roomId === "general") {
      console.log("🌐 Joining general room (no encryption)");
      setStatus("🌐 General chat - no encryption needed");
      setReady(true);
      socket.emit("join-room", { roomId, username: user.username });
      return () => { mounted = false; };
    }
    
    console.log("🔐 Setting up encryption for private room:", roomId);
    console.log("🔐 Socket connected?", socket.connected);
    console.log("🔐 User:", user?.username);
    
    const gen = async () => {
      // Check for Web Crypto API availability
      const hasCrypto = window?.crypto && window.crypto.subtle;
      console.log("🔐 Crypto check:", {
        hasWindow: !!window,
        hasCrypto: !!window?.crypto,
        hasSubtle: !!window?.crypto?.subtle,
        isSecureContext: window.isSecureContext,
        location: window.location?.protocol
      });
      
      if (!hasCrypto) {
        console.error("❌ Web Crypto API not available. Protocol:", window.location?.protocol);
        setStatus("⚠️ Encryption unavailable (requires HTTPS or localhost)");
        // For private rooms without crypto, still join but warn user
        socket.emit("join-room", { roomId, username: user.username });
        return;
      }
      try {
        console.log("🔐 Starting RSA key generation...");
        // RSA-OAEP for key-wrapping (small data)
        const kp = await crypto.subtle.generateKey(
          {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
          },
          true,
          ["encrypt", "decrypt"]
        );
        console.log("✅ RSA keypair generated");
        
        privateRsaRef.current = kp.privateKey;
        const exported = await crypto.subtle.exportKey("spki", kp.publicKey);
        const pubB64 = bufToBase64(exported);
        
        console.log("🔑 Public key exported, length:", pubB64.length);
        console.log("🔑 Generated RSA keypair, sending public-key for room:", roomId);
        console.log("🔑 Sending to socket, connected:", socket.connected);
        
        // publish to server and join room (server will request members list)
        socket.emit("public-key", { roomId, username: user.username, publicKey: pubB64 });
        console.log("✅ public-key emitted");
        
        socket.emit("join-room", { roomId, username: user.username });
        console.log("✅ join-room emitted");
      } catch (err) {
        console.error("❌ RSA keygen error", err);
        if (mounted) setStatus("⚠️ Crypto error");
      }
    };
    
    // Wait for socket to be connected before generating keys
    if (socket.connected) {
      gen();
    } else {
      console.log("⏳ Waiting for socket connection...");
      socket.on("connect", () => {
        console.log("✅ Socket connected, generating keys...");
        gen();
      });
    }
    return () => { mounted = false; };
  }, [roomId, user]);

  // socket listeners
  useEffect(() => {
    // room settings (mode/policy)
    socket.on('room-settings', ({ roomId: rid, mode, policy } = {}) => {
      if (rid && rid !== roomId) return;
      const safeMode = mode || 'casual';
      setRoomMode(safeMode);
      setAudioMutedByPolicy(!!policy?.globalMute);
      setVideoDisabledByPolicy(!!policy?.noVideo);
      setScreenShareEnabledByPolicy(!!policy?.screenShareEnabled);

    });

    // receive members list (username, socketId, publicKey)
    socket.on("room-members", async (list = []) => {

      console.log("📥 Received room-members:", list);
      setMembers(list || []);
      // import others' RSA public keys for wrapping AES key (if present)
      const map = {};
      for (const m of list) {
        if (m.username === user.username) continue;
        if (!m.publicKey) continue;
        try {
          const keyBuf = base64ToBuf(m.publicKey);
          const pub = await crypto.subtle.importKey("spki", keyBuf, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
          map[m.username] = pub;
        } catch (err) {
          console.warn("Import public key failed for", m.username, err);
        }
      }
      publicKeyMapRef.current = map;

      // owner logic: first member in list is owner
      const owner = list && list[0] && list[0].username;
      const amOwner = owner === user.username;
      
      console.log(`👑 Owner check: owner=${owner}, amOwner=${amOwner}, user=${user.username}`);

      if (amOwner) {
        try {
          // ensure we have a group key
          if (!groupKeyRef.current) {
            const gk = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
            groupKeyRef.current = gk;
            setReady(true);
            setStatus("🔐 Owner — group key created");
          }
          // export raw AES key to send (to all other members, including late joiners)
          const raw = await crypto.subtle.exportKey("raw", groupKeyRef.current);
          const rawU8 = new Uint8Array(raw);
          for (const m of list) {
            if (m.username === user.username) continue;
            if (!m.publicKey || !m.socketId) continue;
            try {
              let theirPub = publicKeyMapRef.current[m.username];
              if (!theirPub) {
                const keyBuf = base64ToBuf(m.publicKey);
                theirPub = await crypto.subtle.importKey("spki", keyBuf, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
                publicKeyMapRef.current[m.username] = theirPub;
              }
              const enc = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, theirPub, rawU8);
              const encB64 = bufToBase64(enc);
              socket.emit("forward-group-key", {
                roomId,
                toSocketId: m.socketId,
                fromUsername: user.username,
                encryptedKeyBase64: encB64,
              });
            } catch (err) {
              console.error("Wrap key for member failed", m.username, err);
            }
          }
        } catch (err) {
          console.error("Owner group key handling failed", err);
        }
      }
    });

    // when someone forwards group-key to us
    socket.on("group-key", async ({ encryptedKeyBase64 }) => {
      try {
        if (!privateRsaRef.current) {
          console.warn("No private key to unwrap group key");

          return;
        }
        const encBuf = base64ToBuf(encryptedKeyBase64);
        const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateRsaRef.current, encBuf);
        // import AES key raw
        const gk = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
        groupKeyRef.current = gk;
        setReady(true);
        setStatus("🔑 Group key received");

      } catch (err) {
        console.error("Unwrap group key failed", err);
      }
    });


    // history (for 'general' room)
    socket.on("chat-history", (history = []) => {
      // history: array of { username, text, time }
      setMessages((prev) => {
        // avoid duplicating if history already loaded
        if (historyLoaded) return prev;
        setHistoryLoaded(true);
        return [...history.map((h) => ({ username: h.username, text: h.text, time: h.time || "" })), ...prev];
      });
    });

    // incoming chat-message (either encrypted or plaintext)
    socket.on("chat-message", async (msg) => {
      // msg may be:
      // { roomId, username, encrypted, iv, data, time }  OR
      // { roomId, username, text, time } (plaintext) OR
      // { roomId, username, image, imageName, time } (image)
      if (msg.image) {
        setMessages((prev) => [...prev, { username: msg.username, image: msg.image, imageName: msg.imageName, time: msg.time || "" }]);
        return;
      }
      if (msg.encrypted) {
        if (!groupKeyRef.current) {
          // we don't have key yet; stash a placeholder
          setMessages((prev) => [...prev, { username: msg.username, text: "[encrypted message — key not ready]" }]);
          return;
        }
        const pt = await aesGcmDecryptRaw(groupKeyRef.current, msg.iv, msg.data, `${msg.roomId}:${msg.username}`);
        const text = pt ? u8ToStr(pt) : "[decryption failed]";
        setMessages((prev) => [...prev, { username: msg.username, text, time: msg.time || "" }]);
      } else if (msg.text) {
        setMessages((prev) => [...prev, { username: msg.username, text: msg.text, time: msg.time || "" }]);
      } else {
        // defensive
        console.warn("Unknown chat-message format:", msg);
      }
    });

    socket.on("system-message", (txt) => {
      setMessages((prev) => [...prev, { system: true, text: txt, time: "" }]);
    });

    socket.on("typing", (username) => {
      if (!username || username === user.username) return;
      setTypingUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTypingUsers([]), 1200);
    });

    socket.on("video-offer", async ({ fromUsername, fromSocketId, offer }) => {
      try {
        if (!peerConnectionRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;

          const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
          peerConnectionRef.current = peer;
          stream.getTracks().forEach((track) => peer.addTrack(track, stream));
          peer.ontrack = (event) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
          };
          peer.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit("video-ice-candidate", { roomId, toSocketId: fromSocketId, candidate: event.candidate });
            }
          };
        }

        const peer = peerConnectionRef.current;
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("video-answer", { roomId, toSocketId: fromSocketId, answer, fromUsername: user.username });
        setVideoActive(true);

      } catch (err) {
        console.error("Video offer handling failed", err);
      }
    });

    socket.on("video-answer", async ({ answer }) => {

      try {
        if (!peerConnectionRef.current) return;
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));

        setVideoActive(true);
        setVideoStatus("Video call connected");
      } catch (err) {
        console.error("Video answer handling failed", err);
      }
    });

    socket.on("video-ice-candidate", async ({ candidate }) => {

      try {
        if (!peerConnectionRef.current || !candidate) return;
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("ICE candidate handling failed", err);
      }
    });

    socket.on("new-owner", ({ roomId: rid, newOwner }) => {

      if (rid !== roomId) return;
      if (newOwner.username === user.username) {
        setStatus("🔁 You are the new owner — generating new group key...");
        // owner will receive room-members event and then create a key in that flow
      } else {
        setStatus(`🔁 ${newOwner.username} is new owner — waiting for key...`);
        groupKeyRef.current = null;
        setReady(false);
      }
    });

    return () => {
      socket.off("room-members");
      socket.off("group-key");
      socket.off("chat-history");
      socket.off("chat-message");
      socket.off("system-message");
      socket.off("typing");
      socket.off("video-offer");
      socket.off("video-answer");
      socket.off("video-ice-candidate");
      socket.off("new-owner");
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user.username]);

  // send message (either encrypted with AES or plaintext for 'general')
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const timeStr = new Date().toISOString();
    if (roomId === "general") {
      // plaintext, server will save
      const payload = { roomId, username: user.username, text: input, time: timeStr };
      socket.emit("chat-message", payload);
      setMessages((prev) => [...prev, { username: user.username, text: input, time: timeStr }]);
      setInput("");
      return;
    }

    // encrypted path
    if (!groupKeyRef.current) {
      toast("Waiting for encryption key…", { icon: "⏳" });
      return;
    }

    try {
      const encoded = strToU8(input);
      const enc = await aesGcmEncryptRaw(groupKeyRef.current, encoded, `${roomId}:${user.username}`);
      const payload = {
        roomId,
        username: user.username,
        encrypted: true,
        iv: enc.iv,
        data: enc.data,
        time: timeStr,
      };
      socket.emit("chat-message", payload);
      // show local message in UI (plaintext)
      setMessages((prev) => [...prev, { username: user.username, text: input, time: timeStr }]);
      setInput("");
    } catch (err) {
      console.error("Failed to encrypt/send", err);
    }
  }, [input, roomId, user.username]);

  const sendImage = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      toast("Please choose an image file.", { icon: "📷" });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const payload = { roomId, username: user.username, image: reader.result, imageName: file.name, time: new Date().toISOString() };
        socket.emit("chat-message", payload);
        setMessages((prev) => [...prev, { username: user.username, image: reader.result, imageName: file.name, time: payload.time }]);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to share image", err);
      toast("Unable to share image right now.", { icon: "⚠️" });
    }
  }, [roomId, user.username]);

  const handleImagePick = (event) => {
    const file = event.target.files?.[0];
    if (file) sendImage(file);
    event.target.value = "";
  };


  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error("This browser does not support screen sharing.");
      return;
    }
    if (isProfessional && !screenShareEnabledByPolicy) {
      toast.error("Screen sharing is disabled by room policy.");
      return;
    }
    if (!members || members.length < 2) {
      toast("Invite one more member to start screen sharing.", { icon: "🖥️" });
      return;
    }

    try {
      setScreenShareStatus("Requesting display capture...");
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      localScreenStreamRef.current = stream;
      setScreenSharingActive(true);
      setScreenShareStatus("Screen share active");

      // Reuse existing RTCPeerConnection and add/replace tracks is complex; simplest: add tracks
      // Note: remote support for screen share depends on peer implementation.
      if (!peerConnectionRef.current) {
        const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        peerConnectionRef.current = peer;

        const remoteTrackHandler = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
        peer.ontrack = remoteTrackHandler;
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            const target = members.find((member) => member.username !== user.username);
            if (target?.socketId) {
              socket.emit("video-ice-candidate", { roomId, toSocketId: target.socketId, candidate: event.candidate });
            }
          }
        };
      }

      // Add display track(s)
      const peer = peerConnectionRef.current;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const target = members.find((member) => member.username !== user.username);
      if (!target?.socketId) throw new Error("No teammate available for screen sharing.");

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("video-offer", {
        roomId,
        toSocketId: target.socketId,
        fromSocketId: socket.id,
        fromUsername: user.username,
        offer,
      });
    } catch (err) {
      console.error("Screen share failed", err);
      setScreenSharingActive(false);
      setScreenShareStatus("Screen share failed");
    }
  }, [screenShareEnabledByPolicy, isProfessional, members, roomId, user.username]);

  const startVideoCall = useCallback(async () => {
    if (videoDisabledByPolicy) {
      toast.error("Video is disabled by room policy.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {

      toast.error("This browser does not support video calls.");
      return;
    }

    if (members.length < 2) {
      toast("Invite one more member to start a video chat.", { icon: "📹" });
      return;
    }

    try {
      setVideoStatus("Requesting camera and microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peerConnectionRef.current = peer;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          const target = members.find((member) => member.username !== user.username);
          if (target?.socketId) {
            socket.emit("video-ice-candidate", { roomId, toSocketId: target.socketId, candidate: event.candidate });
          }
        }
      };

      const target = members.find((member) => member.username !== user.username);
      if (!target?.socketId) {
        throw new Error("No teammate available for video chat.");
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("video-offer", { roomId, toSocketId: target.socketId, fromSocketId: socket.id, fromUsername: user.username, offer });
      setVideoActive(true);
      setVideoStatus(`Calling ${target.username}...`);
    } catch (err) {
      console.error("Video call start failed", err);
      toast.error("Could not start video chat.");
      stopVideoCall();
    }
  }, [
      members,
      roomId,
      stopVideoCall,
      user.username,
      videoDisabledByPolicy
    ]);

  // helper: show username similar to whatsapp (only when new author)
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!user?.username || !roomId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socket.emit("typing", { roomId, username: user.username });
    typingTimerRef.current = setTimeout(() => setTypingUsers([]), 1200);
  };

  const shouldShowUsername = (idx) => {
    const m = messages[idx];
    if (!m || m.system) return false;
    if (m.username === user.username) return false;
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    return prev.username !== m.username;
  };

  return (
    <div
      className="flex flex-col h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 select-none"
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      {/* Enhanced Header */}
      <header className="p-4 bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200/50 flex items-center justify-between gap-4 dark:bg-gray-900/80 dark:border-gray-700/50">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {roomId?.slice(0, 2)?.toUpperCase() || "R"}
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-800 dark:text-gray-100">Room: {roomId}</h1>
            <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                {members?.length || 0} online
              </span>
              {members?.[0] && (
                <span>· owner: <span className="font-medium text-indigo-600 dark:text-indigo-400">{members[0].username}</span></span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={videoActive ? stopVideoCall : startVideoCall}
            disabled={videoDisabledByPolicy}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm shadow-sm transition ${
              videoActive
                ? "bg-rose-500 text-white hover:bg-rose-600"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            } ${videoDisabledByPolicy ? "opacity-50 cursor-not-allowed hover:bg-indigo-600" : ""}`}
          >
            {videoActive ? <VideoOff size={16} /> : <Video size={16} />}
            {videoDisabledByPolicy ? "Video Disabled" : videoActive ? "End Call" : "Video Call"}
          </button>

          <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full ${
            ready 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          }`}>
            <div className={`h-2 w-2 rounded-full ${ready ? "bg-green-500" : "bg-yellow-500"}`}></div>
            {status}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startScreenShare}
              disabled={(!isProfessional && !screenShareEnabledByPolicy) || !screenShareEnabledByPolicy || screenSharingActive}
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm shadow-sm transition ${
                screenSharingActive
                  ? "bg-yellow-500 text-white"
                  : "bg-violet-600 text-white hover:bg-violet-700"
              } ${
                (!isProfessional && !screenShareEnabledByPolicy) || !screenShareEnabledByPolicy
                  ? "opacity-50 cursor-not-allowed hover:bg-violet-600"
                  : ""
              }`}
              title={isProfessional ? (screenShareEnabledByPolicy ? 'Start screen share' : 'Screen share disabled') : 'Casual rooms do not allow screen share'}
            >
              🖥️ {screenSharingActive ? 'Sharing…' : 'Screen Share'}
            </button>
            <button 
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <span>Leave Room</span>
            </button>
          </div>

        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {videoActive && (
          <div className="absolute right-4 top-20 z-10 grid gap-3 md:grid-cols-2 w-[min(92vw,460px)]">
            <div className="rounded-2xl border border-white/60 bg-black/80 p-2 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200 mb-1">You</p>
              <video ref={localVideoRef} autoPlay muted playsInline className="h-32 w-full rounded-xl bg-gray-950 object-cover" />
            </div>
            <div className="rounded-2xl border border-white/60 bg-black/80 p-2 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200 mb-1">Peer</p>
              <video ref={remoteVideoRef} autoPlay playsInline className="h-32 w-full rounded-xl bg-gray-950 object-cover" />
            </div>
          </div>
        )}
        {/* Enhanced Messages Area */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-gradient-to-b from-transparent to-gray-50/30 dark:to-gray-900/30">
          {(!historyLoaded && roomId === 'general') ? (
            <div className="space-y-4" aria-busy="true">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                  <div className="px-4 py-3 rounded-2xl max-w-md bg-gray-200 dark:bg-gray-800 h-12 w-64 animate-pulse" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-lg font-medium mb-2">Start the conversation!</h3>
                <p className="text-sm">Send your first message to begin chatting</p>
              </div>
            </div>
          ) : (
            messages.map((m, i) =>
              m.system ? (
                <div key={i} className="flex justify-center my-2">
                  <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-full text-sm shadow-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className={`flex ${m.username === user.username ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-md ${m.username === user.username ? "order-2" : "order-1"}`}>
                    {shouldShowUsername(i) && (
                      <div className={`text-xs font-medium mb-1 px-1 ${
                        m.username === user.username ? "text-right text-indigo-600 dark:text-indigo-400" : "text-left text-gray-600 dark:text-gray-400"
                      }`}>
                        {m.username}
                      </div>
                    )}
                    <div className={`px-4 py-3 rounded-2xl shadow-sm transition-all hover:shadow-md ${
                      m.username === user.username 
                        ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-br-md" 
                        : "bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-gray-100 rounded-bl-md"
                    }`}>
                      {m.image ? (
                        <div className="space-y-2">
                          <img src={m.image} alt={m.imageName || "Shared image"} className="max-w-xs rounded-xl border border-white/20" />
                          {m.imageName && <p className="text-xs opacity-80">{m.imageName}</p>}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{m.text}</div>
                      )}
                      <div className={`mt-2 flex items-center gap-2 text-[11px] ${
                        m.username === user.username ? "text-indigo-100" : "text-gray-400 dark:text-gray-500"
                      }`}>
                        <span>{m.time ? new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        {m.username === user.username && <span className="rounded-full bg-white/15 px-2 py-0.5">Sent</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Members Sidebar */}
        <aside className="w-64 bg-white/80 backdrop-blur-sm border-l border-gray-200/50 p-4 overflow-y-auto dark:bg-gray-900/80 dark:border-gray-700/50 hidden lg:block">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Members</h3>
            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full text-xs font-medium">
              {members.length}
            </span>
          </div>
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.socketId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {m.username?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900"></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
                    {m.username}
                    {members[0]?.username === m.username && (
                      <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                        owner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                    {m.socketId?.slice?.(0, 8)}...
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Enhanced Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200/50 dark:bg-gray-900/80 dark:border-gray-700/50">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={handleInputChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-2xl px-4 py-3 pr-12 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm"
              placeholder={ready ? "Type a message..." : (roomId === "general" ? "Type a message..." : "Waiting for group key...")}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={!ready && roomId !== "general"}
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl text-gray-700 dark:text-gray-100 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Share image"
          >
            <ImagePlus size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          <button 
            type="button" 
            onClick={sendMessage} 
            disabled={(!ready && roomId !== "general") || !input.trim()} 
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg transition-all hover:shadow-xl active:scale-95"
          >
            <Send size={18} /> 
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
        {typingUsers.length > 0 && (
          <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        )}
        {!ready && roomId !== "general" && (
          <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
            Waiting for encryption key to be established...
          </div>
        )}
      </div>
    </div>
  );
}
