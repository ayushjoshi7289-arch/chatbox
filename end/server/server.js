// server/server.js
require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const passport = require("passport");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Models (SQLite-backed compatibility layer)
const User = require("./models/User");
const Room = require("./models/Room");
const Message = require("./models/Message");
const { db, run, get, all } = require("./db");

// Passport config
const initializePassport = require("./auth/passport-config");
initializePassport(passport);

const app = express();
const server = http.createServer(app);

// Socket.io
const allowedOrigins = [
  process.env.CLIENT_URL,
  // "http://10.237.224.218:5173",
  "http://localhost:5173"//,
  // "http://127.0.0.1:5173",
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked by Socket.IO"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ---------------- GLOBAL STATE ----------------
// rooms active participants map for runtime (temporary)
const roomsActive = {}; // { roomId: Set(username) }
const roomMembers = {}; // { roomId: [ { socketId, username, publicKey } ] }
const waitingQueue = [];
const onlineUsers = new Map(); // userId -> socketId
const MATCH_TARGETS = {
  duo: 2,
  group: 4,
  party: 4,
};

// ---------------- MIDDLEWARE ----------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS blocked"));
  },
  credentials: true,
}));

// Rate limiting middleware
const rateLimitMap = new Map();
const rateLimit = (windowMs = 60000, maxRequests = 100) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, []);
    }
    
    const requests = rateLimitMap.get(ip);
    // Remove old requests outside the window
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({ success: false, message: 'Too many requests' });
    }
    
    validRequests.push(now);
    rateLimitMap.set(ip, validRequests);
    next();
  };
};

app.use('/api/', rateLimit(60000, 100)); // 100 requests per minute per IP
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallbacksecret",
    resave: false,
    saveUninitialized: false,
    store: new session.MemoryStore(),
    cookie: { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    name: 'chatbox.sid' // Custom session name
  })
);

// Trust proxy for correct secure cookie handling behind proxies (e.g., nginx/Heroku)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(passport.initialize());
app.use(passport.session());

// ---------------- DATABASE ----------------
console.log("✅ SQLite database ready at", db.name);

// ---------------- AUTH ROUTES ----------------
  // Signup
app.post("/api/auth/signup", async (req, res) => {
  const usernameInput = String(req.body.username || "").trim();
  const displayNameInput = String(req.body.displayName || "").trim();
  const { password } = req.body;

  const profileTypeInput = String(req.body.profileType || "both").toLowerCase();
  const profileType = ["office", "casual", "both"].includes(profileTypeInput) ? profileTypeInput : "both";

  const allowedProfiles =
    profileType === "office" ? ["office"] : profileType === "casual" ? ["casual"] : ["office", "casual"];

  const initialOfficeProfile = {
    displayName: displayNameInput || usernameInput,
    bio: "",
    avatarUrl: "",
  };

  const initialCasualProfile = {
    displayName: displayNameInput || usernameInput,
    bio: "",
    avatarUrl: "",
  };


  if (!usernameInput || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required" });
  }

  if (!/^[A-Za-z0-9_-]{3,20}$/.test(usernameInput)) {
    return res.status(400).json({ success: false, message: "Usernames must be 3–20 characters using letters, numbers, underscores, or hyphens" });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters long" });
  }

  try {
    const existing = await User.findOne({ username: usernameInput });
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: usernameInput,
      displayName: displayNameInput || usernameInput, // legacy
      password: hashed,
      allowedProfiles,
      activeProfile: allowedProfiles.includes("office") ? "office" : "casual",
      officeProfileJson: initialOfficeProfile,
      casualProfileJson: initialCasualProfile,
      linkingMode: "none",
    });

    // Auto-login
    req.login(newUser, (err) => {

      if (err) {
        console.error("Auto login error:", err);
        return res.status(500).json({ success: false, message: "Auto login failed" });
      }
      return res.json({ success: true, user: { _id: newUser._id, username: newUser.username, displayName: newUser.displayName } });
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Signup failed. Please try again." });
  }
});

// Login
app.post("/api/auth/login", (req, res, next) => {
  const usernameInput = String(req.body.username || "").trim();
  const { password } = req.body;

  if (!usernameInput || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required" });
  }

  req.body.username = usernameInput;

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Login error:", err);
      return next(err);
    }
    if (!user) {
      return res.status(400).json({ success: false, message: info?.message || "Invalid credentials" });
    }
    req.login(user, (err) => {
      if (err) {
        console.error("Session login error:", err);
        return next(err);
      }
      return res.json({ success: true, user: { _id: user._id, username: user.username, displayName: user.displayName } });
    });
  })(req, res, next);
});

// Current user
app.get("/api/auth/me", (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Not authenticated" });

  const u = req.user;
  const active = u.activeProfile || "casual";
  const office = u.officeProfileJson || {};
  const casual = u.casualProfileJson || {};

  // Apply linking mode best-effort
  const linkingMode = u.linkingMode || "none";
  let mergedOffice = office;
  let mergedCasual = casual;

  if (linkingMode === "shareAvatar") {
    const sharedAvatar = office.avatarUrl || casual.avatarUrl || "";
    mergedOffice = { ...office, avatarUrl: sharedAvatar };
    mergedCasual = { ...casual, avatarUrl: sharedAvatar };
  } else if (linkingMode === "shareDisplayName") {
    const sharedDisplayName = office.displayName || casual.displayName || "";
    mergedOffice = { ...office, displayName: sharedDisplayName };
    mergedCasual = { ...casual, displayName: sharedDisplayName };
  } else if (linkingMode === "shareEverything") {
    const merged = { ...office };
    if (!merged.avatarUrl && casual.avatarUrl) merged.avatarUrl = casual.avatarUrl;
    if (!merged.displayName && casual.displayName) merged.displayName = casual.displayName;
    if (!merged.bio && casual.bio) merged.bio = casual.bio;
    mergedOffice = merged;
    mergedCasual = merged;
  }

  const activeProfile = active === "office" ? mergedOffice : mergedCasual;

  return res.json({
    success: true,
    user: {
      ...u,
      displayName: activeProfile.displayName || u.displayName || u.username,
      bio: activeProfile.bio || "",
      avatarUrl: activeProfile.avatarUrl || u.avatarUrl || "",
      officeProfile: mergedOffice,
      casualProfile: mergedCasual,
      activeProfileType: active,
      allowedProfiles: u.allowedProfiles || ["casual", "office"],
      linkingMode,
    },
  });
});

// Switch active profile (office/casual)
app.post("/api/profile/switch", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  const profileType = String(req.body.profileType || "casual").toLowerCase();
  if (!["office", "casual"].includes(profileType)) return res.status(400).json({ success: false, message: "Invalid profileType" });
  const allowed = req.user.allowedProfiles || ["casual", "office"];
  if (!allowed.includes(profileType)) return res.status(400).json({ success: false, message: "Profile not allowed" });

  try {
    const updated = await User.findByIdAndUpdate(req.user.id, { activeProfile: profileType });
    return res.json({ success: true, user: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Switch failed" });
  }
});

// Link office + casual profiles (best-effort)
app.post("/api/profile/link", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  const mode = String(req.body.mode || "none").toLowerCase();
  const allowedModes = ["none", "shareAvatar", "shareDisplayName", "shareEverything"];
  if (!allowedModes.includes(mode)) return res.status(400).json({ success: false, message: "Invalid mode" });

  try {
    const updated = await User.findByIdAndUpdate(req.user.id, { linkingMode: mode });
    return res.json({ success: true, user: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Link failed" });
  }
});

// Update profile (displayName, bio, avatarUrl) in active context
app.post("/api/profile", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  const { displayName, bio, avatarUrl } = req.body || {};
  try {
    const active = req.user.activeProfile || "casual";

    const nextOffice = { ...(req.user.officeProfileJson || {}) };
    const nextCasual = { ...(req.user.casualProfileJson || {}) };

    if (active === "office") {
      if (typeof displayName === "string") nextOffice.displayName = displayName.slice(0, 80);
      if (typeof bio === "string") nextOffice.bio = bio.slice(0, 500);
      if (typeof avatarUrl === "string") nextOffice.avatarUrl = avatarUrl;
    } else {
      if (typeof displayName === "string") nextCasual.displayName = displayName.slice(0, 80);
      if (typeof bio === "string") nextCasual.bio = bio.slice(0, 500);
      if (typeof avatarUrl === "string") nextCasual.avatarUrl = avatarUrl;
    }

    const updated = await User.findByIdAndUpdate(req.user.id, {
      officeProfileJson: nextOffice,
      casualProfileJson: nextCasual,
    });

    return res.json({ success: true, user: updated });
  } catch (err) {

    console.error("Profile update error:", err);
    res.status(500).json({ success: false, message: "Profile update failed" });
  }
});

// Logout (GET legacy + POST preferred)
app.get("/api/auth/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("chatbox.sid");
      res.json({ success: true });
    });
  });
});

app.post("/api/auth/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("chatbox.sid");
      res.json({ success: true });
    });
  });
});

// ---------------- FRIENDS (same as before) ----------------
// (kept minimal — assumes User model has friendRequests / friends arrays)
app.post("/api/friends/request", async (req, res) => {

  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  const { toUsername } = req.body;
  try {
    const toUser = await User.findOne({ username: toUsername });
    if (!toUser) return res.status(404).json({ success: false, message: "User not found" });
    if (toUser._id === req.user._id) return res.status(400).json({ success: false, message: "You can't add yourself" });

    if (toUser.friendRequests?.some((r) => r.from === req.user._id && r.status === "pending"))
      return res.status(400).json({ success: false, message: "Already requested" });

    toUser.friendRequests = toUser.friendRequests || [];
    toUser.friendRequests.push({
      _id: `fr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      from: req.user._id,
      status: "pending",
    });
    await toUser.save();
    res.json({ success: true, message: "Friend request sent" });
  } catch (err) {
    console.error("Friend request error:", err);
    res.status(500).json({ success: false, message: "Error sending friend request" });
  }
});

app.get("/api/friends/list", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const user = await User.findById(req.user._id).populate("friends", "username displayName online");
    res.json({ success: true, friends: user.friends || [] });
  } catch (err) {
    console.error("Friends list error:", err);
    res.status(500).json({ success: false, message: "Error fetching friends" });
  }
});

// Get friend requests
app.get("/api/friends/requests", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const user = await User.findById(req.user._id).populate("friendRequests.from", "username displayName");
    const requests = user.friendRequests?.filter(req => req.status === "pending") || [];
    res.json({ success: true, requests });
  } catch (err) {
    console.error("Friend requests error:", err);
    res.status(500).json({ success: false, message: "Error fetching friend requests" });
  }
});

// Accept friend request
app.post("/api/friends/accept", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  const { requestId } = req.body;
  try {
    const user = await User.findById(req.user._id);
    const request = user.friendRequests.find(req => req._id.toString() === requestId);
    
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    
    // Add to friends list
    user.friends = user.friends || [];
    user.friends.push(request.from);
    
    // Remove from friend requests
    user.friendRequests = user.friendRequests.filter(req => req._id.toString() !== requestId);
    
    // Add current user to requester's friends list
    const requester = await User.findById(request.from);
    requester.friends = requester.friends || [];
    requester.friends.push(req.user._id);
    
    await user.save();
    await requester.save();
    
    res.json({ success: true, message: "Friend request accepted" });
  } catch (err) {
    console.error("Accept friend request error:", err);
    res.status(500).json({ success: false, message: "Error accepting friend request" });
  }
});

// Decline friend request
app.post("/api/friends/decline", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  const { requestId } = req.body;
  try {
    const user = await User.findById(req.user._id);
    user.friendRequests = user.friendRequests.filter(req => req._id.toString() !== requestId);
    await user.save();
    
    res.json({ success: true, message: "Friend request declined" });
  } catch (err) {
    console.error("Decline friend request error:", err);
    res.status(500).json({ success: false, message: "Error declining friend request" });
  }
});

// ---------------- OFFICE MEETINGS API (SQLite officeSessions) ----------------
app.post("/api/office/sessions/schedule", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  const { title, scheduledAt, durationMins = 30, participants = [] } = req.body || {};
  try {
    if (!title || typeof title !== "string") return res.status(400).json({ success: false, message: "title is required" });
    if (!scheduledAt) return res.status(400).json({ success: false, message: "scheduledAt is required" });

    const dt = new Date(scheduledAt);
    if (isNaN(dt.getTime())) return res.status(400).json({ success: false, message: "Invalid scheduledAt" });

    const parsedParticipants = Array.isArray(participants) ? participants : [];

    const result = run(
      `INSERT INTO officeSessions (roomId, eventsSummary, participants, startedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        `OFFICE-${Math.floor(Math.random() * 9000) + 1000}`,
        JSON.stringify({ title, scheduledAt: dt.toISOString(), durationMins: Number(durationMins) || 30 }),
        JSON.stringify(parsedParticipants),
      ]
    );

    return res.json({ success: true, session: { id: result.lastInsertRowid } });
  } catch (err) {
    console.error("Schedule office session error:", err);
    return res.status(500).json({ success: false, message: "Schedule failed" });
  }
});

app.get("/api/office/sessions/upcoming", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const now = new Date().toISOString();
    const rows = all("SELECT * FROM officeSessions ORDER BY startedAt ASC");

    const sessions = (rows || []).map((r) => {
      let summary = {};
      try { summary = r.eventsSummary ? JSON.parse(r.eventsSummary) : {}; } catch { summary = {}; }
      let parts = [];
      try { parts = r.participants ? JSON.parse(r.participants) : []; } catch { parts = []; }
      return {
        id: r.id,
        roomId: r.roomId,
        scheduledAt: summary.scheduledAt,
        title: summary.title,
        durationMins: summary.durationMins,
        participants: parts,
      };
    });

    // Best-effort upcoming filter
    const upcoming = sessions.filter((s) => (s.scheduledAt ? s.scheduledAt >= now : false)).slice(0, 50);
    return res.json({ success: true, sessions: upcoming });
  } catch (err) {
    console.error("Upcoming office sessions error:", err);
    return res.status(500).json({ success: false, message: "Fetch failed" });
  }
});

app.post("/api/office/sessions/:id/join", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Unauthorized" });
  const id = Number(req.params.id);
  try {
    const row = get(`SELECT * FROM officeSessions WHERE id = ?`, [id]);
    if (!row) return res.status(404).json({ success: false, message: "Session not found" });

    let participants = [];
    try { participants = row.participants ? JSON.parse(row.participants) : []; } catch { participants = []; }

    if (!participants.includes(req.user.username)) participants.push(req.user.username);

    run(`UPDATE officeSessions SET participants = ? WHERE id = ?`, [JSON.stringify(participants), id]);

    return res.json({ success: true });
  } catch (err) {
    console.error("Join office session error:", err);
    return res.status(500).json({ success: false, message: "Join failed" });
  }
});

// ---------------- ROOMS API ----------------
// Return rooms (persistent rooms from DB)
app.get("/api/rooms", async (req, res) => {

  try {
    const rooms = await Room.find({});
    res.json({
      success: true,
      rooms: rooms.map((r) => ({
        code: r.code,
        hasPassword: !!r.password,
        mode: r.mode || 'casual',
      })),
    });
  } catch (err) {
    console.error("Get rooms error:", err);
    res.status(500).json({ success: false, message: "Error fetching rooms" });
  }
});

// Create persistent room (optional password + mode/policy)
app.post("/api/rooms", async (req, res) => {
  const { code, password, mode, policy } = req.body;
  try {
    if (await Room.findOne({ code })) return res.status(400).json({ success: false, message: "Room already exists" });
    const hashed = password ? await bcrypt.hash(password, 10) : null;
    await Room.create({
      code,
      password: hashed,
      mode: mode === 'professional' ? 'professional' : 'casual',
      policy: policy && typeof policy === 'object' ? policy : {},
    });
    io.emit("roomsUpdated");
    res.json({ success: true, room: { code, hasPassword: !!hashed, mode: mode === 'professional' ? 'professional' : 'casual' } });
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ success: false, message: "Room create error" });
  }
});


// Verify room password before join
app.post("/api/rooms/verify", async (req, res) => {
  const { code, password } = req.body;
  try {
    const room = await Room.findOne({ code });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    if (room.password) {
      const ok = await bcrypt.compare(password || "", room.password);
      if (!ok) return res.status(401).json({ success: false, message: "Wrong password" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Verify room error:", err);
    res.status(500).json({ success: false, message: "Verify error" });
  }
});

// ---------------- SOCKET.IO ----------------
io.on("connection", (socket) => {
  console.log("🔌 connected:", socket.id);

// PUBLIC KEY published by client (RSA public key, base64 spki)
socket.on("public-key", ({ roomId, username, publicKey }) => {
  console.log(`🔑 Public key received from ${username} for room ${roomId}`);
  
  if (!roomMembers[roomId]) roomMembers[roomId] = [];

  // If there's an existing entry for this username, update it (socket id / publicKey)
  const idx = roomMembers[roomId].findIndex((m) => m.username === username);
  const entry = { socketId: socket.id, username, publicKey };

  if (idx !== -1) {
    roomMembers[roomId][idx] = entry;
    console.log(`📝 Updated public key for existing member ${username} in room ${roomId}`);
  } else {
    roomMembers[roomId].push(entry);
    console.log(`➕ Added new member ${username} with public key to room ${roomId}`);
  }

  // keep a simple active participant list
  if (!roomsActive[roomId]) roomsActive[roomId] = new Set();
  roomsActive[roomId].add(username);

  // Emit the list to:
  // 1) all sockets already in the room (io.to(roomId))
  // 2) plus directly to the current socket (socket.emit) so a client that hasn't joined yet still gets members
  const payload = (roomMembers[roomId] || []).map((m) => ({
    username: m.username,
    socketId: m.socketId,
    publicKey: m.publicKey,
  }));

  console.log(`📤 Broadcasting room-members after public-key for ${roomId}:`, payload);

  // emit to existing room members
  io.to(roomId).emit("room-members", payload);

  // and ensure the current socket also receives the up-to-date list
  socket.emit("room-members", payload);
});

// Join room: server joins socket to room, sends general history if needed
socket.on("join-room", async ({ roomId, username }) => {
  console.log(`🔌 User ${username} joining room ${roomId}`);
  
  // join the socket to the room (so io.to(roomId) includes this socket)
  socket.join(roomId);

  // Load room settings for professional/casual behavior
  let roomDoc = null;
  try {
    // persistent rooms are keyed by code
    roomDoc = await Room.findOne({ code: roomId });
  } catch (e) {
    roomDoc = null;
  }

  const mode = roomDoc?.mode || (roomId === 'general' ? 'casual' : 'casual');
  const policy = roomDoc?.policy || {};

  // Ensure member receives room-settings (used by client for UI/controls)
  socket.emit('room-settings', { roomId, mode, policy });


  // Ensure roomMembers contains this user (in case public-key wasn't sent first)
  if (!roomMembers[roomId]) roomMembers[roomId] = [];
  const idx = roomMembers[roomId].findIndex((m) => m.username === username);
  if (idx !== -1) {
    // update socketId (in case it changed), but preserve existing publicKey
    const existingPublicKey = roomMembers[roomId][idx].publicKey;
    roomMembers[roomId][idx].socketId = socket.id;
    if (existingPublicKey) {
      roomMembers[roomId][idx].publicKey = existingPublicKey; // preserve it
    }
    console.log(`📝 Updated existing member ${username} in room ${roomId}, publicKey: ${existingPublicKey ? 'exists' : 'null'}`);
  } else {
    // add a placeholder entry without publicKey (client may send it later)
    roomMembers[roomId].push({ socketId: socket.id, username, publicKey: null });
    console.log(`➕ Added new member ${username} to room ${roomId}`);
  }

  // keep runtime active set
  if (!roomsActive[roomId]) roomsActive[roomId] = new Set();
  roomsActive[roomId].add(username);

  // If 'general' -> send stored history
  if (roomId === "general") {
    try {
      const history = await Message.find({ roomId: "general" }).sort({ createdAt: 1 }).lean();
      socket.emit(
        "chat-history",
        history.map((m) => ({ username: m.username, text: m.message, time: m.createdAt }))
      );
    } catch (err) {
      console.error("Error loading general history:", err);
    }
  }

  // After updating roomMembers we should broadcast the new members list to the room
  const payload = (roomMembers[roomId] || []).map((m) => ({
    username: m.username,
    socketId: m.socketId,
    publicKey: m.publicKey,
  }));
  
  console.log(`📤 Broadcasting room-members for ${roomId}:`, payload);
  io.to(roomId).emit("room-members", payload);

  io.to(roomId).emit("system-message", `🔔 ${username} joined`);
  io.emit("roomsUpdated");
});

  socket.on("video-offer", ({ roomId, toSocketId, fromSocketId, fromUsername, offer }) => {
    io.to(toSocketId).emit("video-offer", { roomId, fromSocketId, fromUsername, offer });
  });

  socket.on("video-answer", ({ roomId, toSocketId, answer, fromUsername }) => {
    io.to(toSocketId).emit("video-answer", { roomId, fromUsername, answer });
  });

  socket.on("video-ice-candidate", ({ roomId, toSocketId, candidate }) => {
    io.to(toSocketId).emit("video-ice-candidate", { roomId, candidate });
  });

  // Owner will forward encrypted group-key to a specific member via server
  socket.on("forward-group-key", ({ roomId, toSocketId, fromUsername, encryptedKeyBase64 }) => {
    // server acts as relay
    io.to(toSocketId).emit("group-key", { fromUsername, encryptedKeyBase64 });
  });

  // Client sends chat message. If room === 'general' and message present => save to DB.
socket.on("chat-message", async (data) => {
    // data fields:
    // { roomId, username, encrypted, iv, data }   OR
    // { roomId, username, text }   for plaintext (general)
    try {
      // Enforce professional restrictions: mute (admin-managed)
      // For now, mute enforcement is message-level (no chat broadcast).
      if (data?.roomId && data?.username) {
        const doc = await Room.findOne({ code: data.roomId }).catch(() => null);
        const mode = doc?.mode || 'casual';
        const policy = doc?.policy || {};
        if (mode === 'professional') {
          const muted = policy?.mutedUsers && Array.isArray(policy.mutedUsers)
            ? policy.mutedUsers.includes(data.username)
            : false;
          const globalMute = !!policy?.globalMute;
          if ((globalMute || muted) && data.username !== roomMembers[data.roomId]?.[0]?.username) {
            // sender is muted -> ignore
            return;
          }
        }
      }

      if (data.roomId === "general" && !data.encrypted && typeof data.text === "string") {
        const m = new Message({ roomId: "general", username: data.username, message: data.text });
        await m.save();
      }
    } catch (err) {
      console.error("Message save/enforce error:", err);
      // don't crash the server; continue to emit
    }

    // broadcast to all members (clients handle self-render)
    socket.to(data.roomId).emit("chat-message", data);
  });


  // Leave room
  socket.on("leave-room", ({ roomId, username }) => {
    socket.leave(roomId);

    // remove active
    if (roomsActive[roomId]) {
      roomsActive[roomId].delete(username);
      if (roomsActive[roomId].size === 0) {
        // remove runtime structures
        delete roomsActive[roomId];
        delete roomMembers[roomId];

        // if this room has a persistent DB document (Room), delete it (but NOT 'general')
        if (roomId !== "general") {
          Room.deleteOne({ code: roomId }).catch((err) => console.error("Delete room error:", err));
        }
      }
    }

    if (roomMembers[roomId]) {
      const idx = roomMembers[roomId].findIndex((m) => m.username === username);
      if (idx !== -1) {
        roomMembers[roomId].splice(idx, 1);
        // notify remaining members of updated list
        if (roomMembers[roomId].length > 0) {
          io.to(roomId).emit("room-members", roomMembers[roomId].map((m) => ({ username: m.username, socketId: m.socketId, publicKey: m.publicKey })));
          // if owner left (first), notify new owner so they can rekey if needed
          if (idx === 0 && roomMembers[roomId].length > 0) {
            const newOwner = roomMembers[roomId][0];
            io.to(roomId).emit("new-owner", { roomId, newOwner: { username: newOwner.username, socketId: newOwner.socketId } });
          }
        } else {
          // no members left
          delete roomMembers[roomId];
        }
      }
    }

    io.to(roomId).emit("system-message", `👋 ${username} left`);
    io.emit("roomsUpdated");
  });

  // Quick-match with category-aware queueing
  socket.on("quick-match", ({ username, category = "duo" }) => {
    const normalizedCategory = String(category || "duo").toLowerCase();
    const targetSize = MATCH_TARGETS[normalizedCategory] || 2;

    const existingIndex = waitingQueue.findIndex((w) => w.socketId === socket.id && w.category === normalizedCategory);
    if (existingIndex >= 0) waitingQueue.splice(existingIndex, 1);

    waitingQueue.push({ socketId: socket.id, username, category: normalizedCategory, joinedAt: Date.now() });

    const sameCategoryQueue = waitingQueue.filter((w) => w.category === normalizedCategory);
    if (sameCategoryQueue.length >= targetSize) {
      const matched = sameCategoryQueue.slice(0, targetSize);
      matched.forEach((entry) => {
        const idx = waitingQueue.findIndex((w) => w.socketId === entry.socketId && w.username === entry.username && w.category === entry.category);
        if (idx >= 0) waitingQueue.splice(idx, 1);
      });

      const matchRoom = `MATCH-${normalizedCategory.toUpperCase()}-${Math.floor(Math.random() * 9000) + 1000}`;
      const participants = matched.map((entry) => entry.username);
      roomsActive[matchRoom] = new Set(participants);

      matched.forEach((entry) => {
        io.to(entry.socketId).emit("match-found", {
          roomId: matchRoom,
          category: normalizedCategory,
          participants,
          partner: participants.filter((name) => name !== entry.username),
        });
      });

      io.emit("roomsUpdated");
    } else {
      io.to(socket.id).emit("waiting-for-match", { category: normalizedCategory, targetSize });
    }
  });

  // Typing relay
  socket.on("typing", ({ roomId, username }) => {
    socket.to(roomId).emit("typing", username);
  });

  // Register user online mapping (optional)
  socket.on("register-user", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("user-status", { userId, status: "online" });
  });

  socket.on("disconnect", () => {
    // cleanup onlineUsers if mapped
    for (const [id, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(id);
        io.emit("user-status", { userId: id, status: "offline" });
        break;
      }
    }
    console.log("❌ disconnected:", socket.id);
    io.emit("roomsUpdated");
  });
});

// ---------------- START SERVER ----------------
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});
