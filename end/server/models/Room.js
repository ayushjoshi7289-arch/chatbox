const { get, all, run } = require("../db");

function toRoomRecord(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    code: row.code,
    participants: row.participants || 0,
    password: row.password,
    quickMatch: Boolean(row.quickMatch),
    mode: row.mode || 'casual',
    policy: (() => {
      try {
        return row.policy ? JSON.parse(row.policy) : {};
      } catch {
        return {};
      }
    })(),
    createdAt: row.createdAt,
  };
}


module.exports = {
  async findOne({ code }) {
    return toRoomRecord(get("SELECT * FROM rooms WHERE code = ?", [code]));
  },

  async find() {
    return all("SELECT * FROM rooms").map(toRoomRecord);
  },

  async create(data) {
    const mode = data.mode || 'casual';
    const policy = data.policy || {};
    const result = run(
      "INSERT INTO rooms (code, participants, password, quickMatch, mode, policy) VALUES (?, ?, ?, ?, ?, ?)",
      [
        data.code,
        data.participants || 0,
        data.password || null,
        data.quickMatch ? 1 : 0,
        mode,
        JSON.stringify(policy || {}),
      ]
    );
    return toRoomRecord(get("SELECT * FROM rooms WHERE id = ?", [result.lastInsertRowid]));
  },


  async deleteOne({ code }) {
    run("DELETE FROM rooms WHERE code = ?", [code]);
    return { deletedCount: 1 };
  },
};
