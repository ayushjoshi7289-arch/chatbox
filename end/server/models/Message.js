const { get, all, run } = require("../db");

function toMessageRecord(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    roomId: row.roomId,
    username: row.username,
    message: row.message,
    createdAt: row.createdAt,
    save: async function () {
      const result = run("INSERT INTO messages (roomId, username, message) VALUES (?, ?, ?)", [this.roomId, this.username, this.message]);
      return toMessageRecord(get("SELECT * FROM messages WHERE id = ?", [result.lastInsertRowid]));
    },
  };
}

module.exports = function Message(data = {}) {
  return toMessageRecord({
    id: null,
    roomId: data.roomId,
    username: data.username,
    message: data.message || data.text || "",
    createdAt: new Date().toISOString(),
  });
};

module.exports.find = function (filter = {}) {
  let rows = all("SELECT * FROM messages");

  if (filter.roomId) rows = rows.filter((row) => row.roomId === filter.roomId);

  return {
    sort(spec = { createdAt: 1 }) {
      if (spec?.createdAt === 1) {
        rows = [...rows].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      } else if (spec?.createdAt === -1) {
        rows = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return this;
    },
    lean() {
      return rows.map(toMessageRecord);
    },
  };
};
