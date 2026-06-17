const { get, all, run } = require("../db");

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function serializeJson(value) {
  return JSON.stringify(value || []);
}

function toUserRecord(row) {
  if (!row) return null;

  const record = {
    _id: row.id,
    id: row.id,
    username: row.username,
    password: row.password,

    // legacy single-profile fields
    displayName: row.displayName || "",
    bio: row.bio || "",
    avatarUrl: row.avatarUrl || "",

    // multi-profile fields
    allowedProfiles: (() => {
      try {
        return row.allowedProfiles ? JSON.parse(row.allowedProfiles) : ["casual", "office"];
      } catch {
        return ["casual", "office"];
      }
    })(),
    activeProfile: row.activeProfile || "casual",
    officeProfileJson: (() => {
      try {
        return row.officeProfileJson ? JSON.parse(row.officeProfileJson) : {};
      } catch {
        return {};
      }
    })(),
    casualProfileJson: (() => {
      try {
        return row.casualProfileJson ? JSON.parse(row.casualProfileJson) : {};
      } catch {
        return {};
      }
    })(),
    linkingMode: row.linkingMode || "none",

    friends: parseJson(row.friends),
    friendRequests: parseJson(row.friendRequests),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };


  record.select = function (fields = "") {
    if (!fields || fields === "-password") {
      const { password, ...rest } = record;
      return rest;
    }
    return record;
  };

  record.populate = function () {
    return record;
  };

  record.save = function () {
    const updatedAt = new Date().toISOString();
    run(
      `UPDATE users SET
        username = ?, password = ?, displayName = ?, bio = ?, avatarUrl = ?,
        allowedProfiles = ?, activeProfile = ?, officeProfileJson = ?, casualProfileJson = ?, linkingMode = ?,
        friends = ?, friendRequests = ?,
        updatedAt = ? WHERE id = ?`,
      [
        record.username,
        record.password,
        record.displayName,
        record.bio,
        record.avatarUrl,
        serializeJson(record.allowedProfiles),
        record.activeProfile,
        serializeJson(record.officeProfileJson),
        serializeJson(record.casualProfileJson),
        record.linkingMode,
        serializeJson(record.friends),
        serializeJson(record.friendRequests),
        updatedAt,
        record.id,
      ]
    );
    record.updatedAt = updatedAt;
    return record;
  };


  return record;
}

module.exports = {
  async findOne(filter = {}) {
    if (typeof filter.username !== "undefined") {
      return toUserRecord(get("SELECT * FROM users WHERE username = ?", [filter.username]));
    }
    if (typeof filter.id !== "undefined") {
      return toUserRecord(get("SELECT * FROM users WHERE id = ?", [filter.id]));
    }
    return toUserRecord(get("SELECT * FROM users WHERE 1 = 0"));
  },

  async findById(id) {
    return toUserRecord(get("SELECT * FROM users WHERE id = ?", [id]));
  },

  async findByIdAndUpdate(id, updates) {
    const current = toUserRecord(get("SELECT * FROM users WHERE id = ?", [id]));
    if (!current) return null;
    const next = { ...current, ...updates };
    if (updates.friends) next.friends = updates.friends;
    if (updates.friendRequests) next.friendRequests = updates.friendRequests;

    run(
      `UPDATE users SET username = ?, password = ?, displayName = ?, bio = ?, avatarUrl = ?, friends = ?, friendRequests = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [next.username, next.password, next.displayName, next.bio, next.avatarUrl, serializeJson(next.friends), serializeJson(next.friendRequests), id]
    );

    return toUserRecord(get("SELECT * FROM users WHERE id = ?", [id]));
  },

  async create(data) {
    const result = run(
      `INSERT INTO users (username, password, displayName, bio, avatarUrl, friends, friendRequests) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.username, data.password, data.displayName || "", data.bio || "", data.avatarUrl || "", serializeJson(data.friends || []), serializeJson(data.friendRequests || [])]
    );
    return toUserRecord(get("SELECT * FROM users WHERE id = ?", [result.lastInsertRowid]));
  },

  async find(filter = {}) {
    if (filter._id) return [await this.findById(filter._id)].filter(Boolean);
    return all("SELECT * FROM users");
  },
};
