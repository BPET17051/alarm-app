# Backend API (Express + SQLite)

This folder hosts the first iteration of the shared scheduler API. It exposes login, template management, and audio upload endpoints that the new front-end can consume.

## Prerequisites

- Node.js 18+
- npm

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the example environment file and adjust values:
   ```bash
   cp .env.example .env
   ```
   - `JWT_SECRET` – random long string.
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` – initial admin credential (password hashed on first boot).
   - `CORS_ORIGIN` – comma-separated list of allowed front-end origins.
3. Start the dev server:
   ```bash
   npm run dev
   ```
   The API runs on `http://localhost:4000` by default and creates `data/app.db` + `data/audio`.

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start with hot reload (ts-node-dev). |
| `npm run build` | Type-check and emit JS into `dist/`. |
| `npm start` | Run compiled server from `dist/`. |

## API Overview

- `POST /api/auth/login` – login with admin credentials, sets HttpOnly cookie and returns JWT.
- `POST /api/auth/logout` – clear session cookie.
- `GET /api/auth/me` – returns current user profile (requires auth).
- `GET /api/templates?course=COURSE_ID` – list templates (public).
- `GET /api/templates/:id` – fetch single template (public).
- `POST /api/templates` – create template (auth required).
- `PUT /api/templates/:id` – update template (auth required).
- `DELETE /api/templates/:id` – delete template (auth required).
- `POST /api/audio` – upload audio file (auth required, multipart field name `file`).
- `GET /api/audio/:id` – stream audio file.
- `GET /health` – health probe.

All authenticated routes expect the HttpOnly cookie set by `/api/auth/login`, but you may also send the JWT via the `Authorization: Bearer <token>` header.

## File Storage & Database

- SQLite database lives in `data/app.db`.
- Audio files are stored under `data/audio/`. Each upload is assigned a UUID file name and metadata entry in the `audio_files` table.

> ⚠️ This is a foundation only. You still need to implement schedule CRUD, device role handling, backup scripts, and integration with the front-end.

