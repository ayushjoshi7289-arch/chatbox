const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "chatbox.sqlite"));

function run(sql, params = []) {
  return db.prepare(sql).run(params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(params);
}

function all(sql, params = []) {
  return db.prepare(sql).all(params);
}

run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,

    -- Legacy single-profile fields (kept for backwards compatibility)
    displayName TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    avatarUrl TEXT DEFAULT '',

    -- Multi-profile (office/casual)
    allowedProfiles TEXT DEFAULT '["casual","office"]',
    activeProfile TEXT DEFAULT 'casual',

    -- Each JSON stores { displayName, bio, avatarUrl }
    officeProfileJson TEXT DEFAULT '{}',
    casualProfileJson TEXT DEFAULT '{}',

    -- Linking controls between office and casual (best-effort)
    -- mode: none | shareAvatar | shareDisplayName | shareEverything
    linkingMode TEXT DEFAULT 'none',

    friends TEXT DEFAULT '[]',
    friendRequests TEXT DEFAULT '[]',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);


run(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    participants INTEGER DEFAULT 0,
    password TEXT,
    quickMatch INTEGER DEFAULT 0,
    mode TEXT DEFAULT 'casual',
    policy TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

run(`
  CREATE TABLE IF NOT EXISTS officeSessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roomId TEXT NOT NULL,
    startedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    endedAt TEXT,
    participants TEXT DEFAULT '[]',
    eventsSummary TEXT DEFAULT '{}'
  );
`);


run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roomId TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = { db, run, get, all };
