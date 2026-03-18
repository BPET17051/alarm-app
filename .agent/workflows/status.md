# TIMEALARM Project Status

Last updated: 2026-03-18

## Current Status

- Project: TIMEALARM
- Path: `D:\Jedi_EX_HDX_BAC01\01.Jedi_SIMSET\SIMSET_Project\AlarmWEB\TIMEALARM`
- Purpose: Web app for scheduling and playing workplace public announcement audio
- State: Active development
- Preview server: Stopped
- Git status: `.agent/` is currently untracked

## Tech Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS
- Backend: Express 5 + TypeScript
- Data/Auth/Storage: Supabase
- Deployment files present: Docker, `docker-compose.yml`, `render.yaml`, `vercel.json`

## Completed

- Backend API server is in place with health and time endpoints
- Alarm CRUD routes exist and map Supabase fields into frontend-friendly response fields
- Audio file list, upload, delete, and public URL access routes exist
- Template list, save, and delete routes exist
- Login, logout, JWT issue/verify, and current-user endpoint exist
- Frontend main scheduling screen exists with clock, alarm form, alarm list, controls, and audio enable/disable UI
- Client-side scheduler hook exists and attempts timed playback from synced server time
- Production builds pass for both backend and frontend

## Pending

- Start and verify the full app end-to-end with real environment variables and a live Supabase project
- Implement or wire frontend authentication flow before protected actions are relied on
- Confirm which backend routes must require auth and enforce that consistently
- Add automated tests for backend routes and frontend scheduling behavior
- Replace placeholder/default frontend README with project-specific documentation
- Clean up and commit `.agent/` if it is intended to be part of the repo

## Risks

- Frontend audio upload currently sends no auth token/cookie, while the codebase already includes backend auth. This is likely to break protected uploads once auth is enforced.
- Backend route protection is inconsistent with backend README claims. The current route files expose alarms, templates, and audio operations without `requireAuth`.
- `JWT_SECRET` has an insecure fallback value (`change-me-please`) and admin credentials also have weak defaults. This is unsafe outside local development.
- Project startup depends on `SUPABASE_URL` and `SUPABASE_KEY`; backend will fail fast if they are missing.
- Existing README files are partially outdated and do not fully match the current implementation.
- There are no visible automated tests, so scheduling, playback timing, and route behavior are only validated by build success and manual inspection.

## Verification Snapshot

- `backend`: `npm run build` passed
- `frontend`: `npm run build` passed
- `frontend` build warning: `baseline-browser-mapping` data is older than two months
