"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORS_ORIGIN = exports.TOKEN_TTL_MS = exports.DB_PATH = exports.AUDIO_DIR = exports.DATA_DIR = exports.ADMIN_PASSWORD = exports.ADMIN_USERNAME = exports.JWT_SECRET = exports.APP_PORT = void 0;
require("dotenv/config");
exports.APP_PORT = parseInt(process.env.APP_PORT || '4000', 10);
exports.JWT_SECRET = process.env.JWT_SECRET || 'change-me-please';
exports.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
exports.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
exports.DATA_DIR = process.env.DATA_DIR || 'data';
exports.AUDIO_DIR = process.env.AUDIO_DIR || `${exports.DATA_DIR}/audio`;
exports.DB_PATH = process.env.DB_PATH || `${exports.DATA_DIR}/app.db`;
exports.TOKEN_TTL_MS = parseInt(process.env.TOKEN_TTL_MS || `${1000 * 60 * 60 * 8}`, 10); // default 8h
exports.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
//# sourceMappingURL=config.js.map