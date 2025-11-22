"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("./config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
if (!node_fs_1.default.existsSync(node_path_1.default.dirname(config_1.DB_PATH))) {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(config_1.DB_PATH), { recursive: true });
}
if (!node_fs_1.default.existsSync(config_1.AUDIO_DIR)) {
    node_fs_1.default.mkdirSync(config_1.AUDIO_DIR, { recursive: true });
}
const db = new better_sqlite3_1.default(config_1.DB_PATH);
function migrate() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS audio_files (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      stored_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      course TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      items_json TEXT NOT NULL,
      audio_refs_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS alarms (
      id TEXT PRIMARY KEY,
      h INTEGER NOT NULL,
      m INTEGER NOT NULL,
      label TEXT,
      audio_id TEXT,
      audio_name TEXT,
      notify_status TEXT DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
    const admin = db.prepare('SELECT * FROM users WHERE username = ?').get(config_1.ADMIN_USERNAME);
    if (!admin) {
        const hash = bcryptjs_1.default.hashSync(config_1.ADMIN_PASSWORD, 10);
        db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(config_1.ADMIN_USERNAME, hash, 'admin');
    }
}
migrate();
exports.default = db;
//# sourceMappingURL=db.js.map