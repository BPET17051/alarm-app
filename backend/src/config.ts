import 'dotenv/config';

export const APP_PORT = parseInt(process.env.APP_PORT || '4000', 10);
export const JWT_SECRET = process.env.JWT_SECRET || 'change-me-please';
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const DATA_DIR = process.env.DATA_DIR || 'data';
export const AUDIO_DIR = process.env.AUDIO_DIR || `${DATA_DIR}/audio`;
export const DB_PATH = process.env.DB_PATH || `${DATA_DIR}/app.db`;
export const TOKEN_TTL_MS = parseInt(process.env.TOKEN_TTL_MS || `${1000 * 60 * 60 * 8}`, 10); // default 8h
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
