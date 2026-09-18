# Multi-Channel Alarm Scheduling with Exclusive Lock

Status: Approved for implementation planning
Date: 2026-09-18

## Problem

TIMEALARM currently has one global, undated list of alarms shared by every
browser that opens the site. The team runs multiple simultaneous events
(e.g. "Course A", "Course B") from the same web app and needs each event's
announcements to be scheduled and played completely independently, with no
risk of one event's audio or alarm edits leaking into another's.

Requirements gathered from the team:

- Users create/rename/delete an unlimited number of channels themselves; no
  fixed list.
- No login step for normal use (the team explicitly rejected adding auth
  friction for channel selection).
- Once a browser selects a channel, it is locked into that channel: it
  cannot switch to another channel from inside the app, and no other
  browser can take over that channel while the lock is held.
- The lock is released only when the user explicitly clicks "Unlock / Leave
  this channel" — but see the Lease section below for why this is
  implemented as an auto-expiring lease rather than a permanent flag.
- Saved templates (reusable sets of alarm times) remain shared across all
  channels, unchanged from today.

## Out of scope (explicitly deferred)

- No "force unlock" endpoint or button in this iteration. A stuck lock
  self-resolves via lease expiry (see below). A true emergency override, if
  ever needed, must be a separate admin-authenticated action gated by the
  existing `requireAuth` middleware and an admin role check — not something
  exposed to anonymous users.
- No cron/scheduled cleanup job for stale alarms. `cleanupStaleAlarms` is
  removed from the `GET /alarms` request path (see below) and not replaced
  with a background job until a retention policy is explicitly decided.
- Templates stay global across channels; no per-channel templates.
- No login requirement for channel selection or alarm CRUD.

## Data model

```sql
create table channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lock_token text,
  lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  -- the two lock columns must be set/cleared together; either both null
  -- (unlocked) or both non-null (locked) — never one without the other
  constraint channels_lock_pair check (
    (lock_token is null) = (lock_expires_at is null)
  )
);

-- case/whitespace-insensitive uniqueness so "General", "general", " General "
-- cannot coexist
create unique index channels_name_unique_ci
  on channels (lower(trim(name)));
```

`alarms` gains a required channel reference, added as a bare nullable
column first — the foreign key itself is added once, in step 6 below,
after backfill:

```sql
alter table alarms add column channel_id uuid;
```

### Migration order (must run in this sequence)

1. Create `channels` table (with the case-insensitive unique index).
2. Insert one default row, e.g. `General`.
3. Add `alarms.channel_id` as **nullable**, with no FK yet (SQL above).
4. Backfill: `update alarms set channel_id = <General.id> where channel_id is null`.
5. Alter `alarms.channel_id` to `NOT NULL`.
6. Add the FK constraint (`references channels(id) on delete restrict`)
   and an index on `channel_id` — this is the only place the FK is
   created; steps 5-6 can be one migration once backfill is verified.

Channel name validation (enforced in the API, not just the DB index):
trim whitespace, reject empty/whitespace-only names, enforce a max length
(e.g. 60 chars), and return `409 Conflict` with a clear message on a
duplicate (case/whitespace-insensitive) name.

## Locking: lease, not a static flag

A plain `locked_by` + `locked_at` pair with no expiry means a crashed tab,
closed laptop lid, or lost network connection leaves the channel locked
forever with no recovery path other than a manual override — which the team
does not want as a standing feature. Instead, the lock is a **lease**:

- `lock_token`: opaque token generated client-side with
  `crypto.randomUUID()`.
- `lock_expires_at`: a timestamp computed from the **database's** `now()`,
  never the client's clock (avoids clock-skew bugs).
- Lease duration: 30 seconds. Client renews every ~10 seconds while the
  channel's page is open, regardless of tab visibility (see "Background
  tab throttling" below — the renew loop is not gated on `visible`,
  because a 30s lease would otherwise guarantee losing the channel the
  moment the user switches tabs for more than 30 seconds, which conflicts
  with the "locked until I explicitly unlock" requirement).

### Atomic acquire/renew as a single RPC

Acquire and renew must be one atomic operation on the server, implemented
as a Postgres function called via RPC, not read-then-write from the API
layer (that has a race window). One function handles both cases. The
lease length is fixed at 30 seconds inside the function rather than taken
as a caller-supplied parameter — there's no legitimate reason for a caller
to request a different lease length, so it isn't exposed as input. The
backend only ever calls this RPC using the Supabase secret key, which
already carries full (`service_role`-equivalent) privileges, so the
function runs with the default `SECURITY INVOKER` — there is no need for
`SECURITY DEFINER` (and the search-path-hijack risk that comes with it)
here:

```sql
create or replace function acquire_channel_lock(
  p_channel_id uuid,
  p_token text
) returns table (ok boolean, expires_at timestamptz)
language plpgsql
as $$
declare
  v_row channels%rowtype;
begin
  select * into v_row from channels where id = p_channel_id for update;

  if v_row.id is null then
    return query select false, null::timestamptz;
    return;
  end if;

  if v_row.lock_token is null
     or v_row.lock_expires_at < now()
     or v_row.lock_token = p_token then
    update channels
      set lock_token = p_token,
          lock_expires_at = now() + interval '30 seconds'
      where id = p_channel_id;
    return query select true, now() + interval '30 seconds';
  else
    return query select false, null::timestamptz;
  end if;
end;
$$;
```

This single function serves `POST /channels/:id/lock` (first acquire) and
the periodic renew calls (same token, extends the lease) and the mutation
middleware (see below) — there is no need for a separate RPC per case.

Grants (must be explicit — Postgres grants `EXECUTE` to `PUBLIC` by
default):

```sql
revoke execute on function acquire_channel_lock(uuid, text)
  from public, anon, authenticated;
grant execute on function acquire_channel_lock(uuid, text)
  to service_role;
```

Unlock is a plain conditional update (only the current token holder can
clear it):

```sql
update channels
  set lock_token = null, lock_expires_at = null
  where id = $1 and lock_token = $2;
```

### Middleware validates by renewing, not by reading stale state

If the alarm-mutation middleware only *checks* `lock_expires_at > now()`
without renewing, a mutation can race a lease that expires mid-request,
handing the channel to a new client while the old request still completes.
The middleware for every alarm mutation route therefore calls
`acquire_channel_lock` (same RPC as above) with the caller's token before
performing the mutation. Two outcomes:

- `ok = true`: the lease is valid and has just been extended another 30s;
  proceed with the mutation.
- `ok = false`: reject with `401`/`409` — the caller no longer holds the
  channel.

This means every mutation the client makes implicitly renews its lease,
plus the explicit ~10s renew loop covers idle periods with no mutations.

### Client behavior on lease loss

If a renew call fails (network error, or `ok:false` because someone else
now holds the lease), the frontend must, immediately:

1. Stop `useScheduler` from evaluating/triggering any further alarms.
2. Stop any audio **currently playing** (see "Stopping in-flight playback"
   below) — a scheduler stopping new triggers is not enough if a long
   announcement is already mid-playback when the lease is lost.
3. Clear the channel selection and return to the channel picker screen.

Without step 2, an old client that just lost its lease can still finish
playing over a new client's audio for the remainder of the current file.

### Client-side coordination

- The token is stored in **`sessionStorage`**, not `localStorage`.
  `localStorage` is shared by every tab of the same origin, so two tabs of
  the same browser would silently share one token and both would run the
  scheduler; `sessionStorage` is per-tab.
- A `BroadcastChannel` is additionally used to detect a second tab of the
  same browser attempting to open the same locked channel, so the user
  gets an immediate, friendly "already open in another tab" message rather
  than waiting for a server round-trip. This is a UX nicety only — the
  server-side atomic lease is the actual source of truth; a compromised or
  buggy client cannot bypass the lock by ignoring `BroadcastChannel`.
- Background tab throttling: the renew loop keeps running on its ~10s
  interval while the tab is hidden — it is not paused. Browsers may
  throttle `setInterval` precision in hidden tabs (some clamp to roughly
  once a minute), which is a platform limitation this design cannot fully
  work around; it is called out here rather than silently accepted.
  Regardless of what happened while hidden, when the tab regains
  visibility (`visibilitychange`), the client must successfully renew the
  lease **before** resuming the scheduler — never assume the lease
  survived backgrounding just because the interval kept firing.

## Stopping in-flight playback

`playAudioFile()` currently creates a local `Audio` instance with no
external handle to pause it. This must change so the app has a single
"currently playing" handle it can cancel:

- `playAlarm`/`playAudioFile` return (or accept a callback that receives)
  a cancel handle, and the app keeps a reference to "the currently playing
  alarm" at the top level (e.g. in the scheduler hook or a small
  `AudioPlaybackController`).
- A `stopAlarm()` function pauses/clears that handle and is called on
  lease loss and on explicit unlock.

## Backend API

All new/changed endpoints:

- `GET /channels` — list channels. Response includes only `id`, `name`,
  `locked` (boolean), `expiresAt` (if locked) — **never** `lock_token`.
- `POST /channels` — create `{ name }`; validates/normalizes name; `409` on
  duplicate.
- `DELETE /channels/:id` — requires the `X-Channel-Token` header like any
  other channel-scoped request. Before deleting, the handler calls
  `acquire_channel_lock` with that token, exactly as the alarm middleware
  does. If it returns `ok:false`, reject `409` (someone else holds the
  channel right now). If it returns `ok:true`, the caller has just claimed
  the lease atomically — no other client's concurrent acquire can succeed
  until the delete below completes or the lease naturally expires — so the
  delete that immediately follows cannot race a fresh lock from someone
  else. No separate "is this locked?" read-then-decide step, and no
  separate delete-specific RPC. The actual row delete then relies on the
  `ON DELETE RESTRICT` FK: if any alarm still references this
  `channel_id`, the delete fails and the handler returns `409` with a
  message telling the caller to clear the channel's alarms first. No
  cascade delete in this iteration — the UI would need an explicit "delete
  this channel and all its alarms" confirmation before cascade is ever
  added.
- `POST /channels/:id/lock` — token comes via the `X-Channel-Token` header
  only (see Token transport below, and no query string). Calls
  `acquire_channel_lock`; `200` with `expiresAt` on success, `409` if held
  by another token.
- Renewal reuses the same `POST /channels/:id/lock` endpoint with the same
  token — no separate renew endpoint needed.
- `POST /channels/:id/unlock` — token via `X-Channel-Token` header;
  succeeds only if it matches the current holder.
- All alarm routes move under `/channels/:channelId/alarms/*` and go
  through one shared middleware that:
  1. Validates `channelId` is a real channel.
  2. Calls `acquire_channel_lock` with the caller's token (renew-as-you-go,
     see above); rejects if it fails.
  3. Only then proceeds to the route handler.
- Every alarm query scopes by **both** `id` and `channel_id`, e.g.:

  ```ts
  supabase.from('alarms')
    .update(updates)
    .eq('id', id)
    .eq('channel_id', channelId)
  ```

  today's `PUT /:id` and `DELETE /:id` check only `id` — this is the
  concrete bug that lets one channel mutate another channel's alarm if it
  ever learns/guesses its UUID.

### Removing the GET side effect

`GET /alarms` currently calls `cleanupStaleAlarms`, which deletes rows by
`created_at` bounds with **no channel scoping** — opening any one channel
today would delete stale rows belonging to every channel. For this
iteration, `cleanupStaleAlarms` is removed from the `GET` handler entirely
(no replacement cron; see Out of scope). If cleanup is wanted later, it
needs its own explicitly-triggered endpoint or scheduled job, scoped by
`channel_id`, decided together with a real retention policy.

### Token transport

The lock/lease token travels in a request header (e.g. `X-Channel-Token`),
not in the query string, to avoid it landing in server logs/proxies that
log query strings by default.

## Security

- **Supabase key naming**: Supabase is deprecating the legacy
  `service_role`/`anon` JWT keys by end of 2026 in favor of new secret/
  publishable keys. This project's backend must use the new secret key,
  named consistently as `SUPABASE_SECRET_KEY` (value shaped like
  `sb_secret_...`), updated in:
  - [config.ts](../../backend/src/config.ts) — rename `SUPABASE_KEY` to
    `SUPABASE_SECRET_KEY`.
  - [db.ts](../../backend/src/db.ts) — use the renamed constant.
  - `backend/.env.example` — add `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
    (currently missing from the example file entirely) with a comment that
    this key must never be shipped to the frontend.
  - [render.yaml](../../render.yaml) — update the env var name to match.
- **RPC grants**: closing table RLS is not sufficient by itself — Postgres
  grants `EXECUTE` on functions to `PUBLIC` by default, so
  `acquire_channel_lock` (and any other lock RPC) must have `EXECUTE`
  explicitly revoked from `public`/`anon`/`authenticated` and granted only
  to `service_role`, or any client could call
  `/rest/v1/rpc/acquire_channel_lock` directly and bypass Express
  entirely. Grants and RLS are configured separately and both matter.
- **RLS policies**: `channels` must not have a public write policy.
  `alarms`/`templates` currently use `FOR ALL USING (true)`, which already
  lets any holder of the anon key bypass the Express backend (and thus
  bypass locking) via Supabase's Data API directly. Tightening this is a
  pre-existing gap that this feature depends on closing, so it is in scope
  here: only the backend (via the secret key, which bypasses RLS) should
  be able to write these tables.
  - Note explicitly in the spec/PR that `templates` and `audio` uploads
    currently have no auth in front of them at the Express layer either;
    this iteration does not add `requireAuth` to those routes, so record
    that as a deliberate, known state — not an oversight — unless the team
    wants it addressed in the same pass.
  - CORS configuration is not a substitute for authorization and should
    not be treated as one anywhere in this design.

## Template payload stays channel-neutral

`mapAlarm()` currently spreads every DB column (`...a`), and
`saveTemplate` in [AlarmsContext.tsx](../../frontend/src/context/AlarmsContext.tsx)
serializes whatever is in `items` straight into `items_json`. Once alarms
carry `channel_id`, that would leak into saved templates and get replayed
into whatever channel later loads the template. Fix: define an explicit,
minimal template-item shape —
`{ h, m, s, audioId, audioDisplayName }` — and build that shape explicitly
when saving a template, rather than spreading the full alarm object.

## Frontend flow

1. **Channel picker** (new screen, shown before Home): lists channels with
   live-ish status (poll `GET /channels` every ~4s), a "create channel"
   action, and disables/greys out channels currently locked by someone
   else. Selecting a free channel calls `POST /channels/:id/lock`, stores
   `{ channelId, token }` in `sessionStorage`, and navigates to Home scoped
   to that channel.
2. **Home**: shows the current channel's name and a single "Unlock / Leave
   this channel" button (calls `stopAlarm()`, then
   `POST /channels/:id/unlock`, clears `sessionStorage`, returns to the
   picker). No other UI path exists to switch channels from within Home.
3. **Renew loop**: while Home is mounted, renew every ~10s via the lock
   endpoint regardless of tab visibility (subject to browser throttling of
   hidden-tab timers, noted above). On visibility regain after being
   backgrounded, renew immediately before letting the scheduler resume.
   Any renew failure triggers the lease-loss sequence described above.
4. **Reload recovery**: on load, if `sessionStorage` has
   `{ channelId, token }`, call the same lock endpoint for that channel —
   it transparently renews a still-live lease or reacquires an expired one
   for the same token, there is no separate "fresh acquire" path; on
   success go straight to Home and resume, on failure (someone else holds
   it now) clear storage and show the picker.
5. `useAlarms`/`useScheduler`/`services/api.ts` thread `channelId` through
   every call so they only ever see the current channel's alarms.

## Testing

A single integration test suite must cover the lock RPC end-to-end:

- Two different tokens racing to lock the same channel: exactly one gets
  `200`, the other gets `409`.
- The same token renewing an already-held lock succeeds and extends
  `expires_at`.
- After a lease expires, a different token can acquire the channel
  (takeover).
- Once takeover happens, the original (now-stale) token is rejected on
  both renew and on any alarm mutation.
- An anonymous/anon-key caller invoking
  `rpc/acquire_channel_lock` directly (bypassing Express) is rejected at
  the grant level.

Additional coverage expected as part of normal frontend testing (not a new
suite): losing the lease stops both the scheduler and any in-flight audio,
and a duplicate-tab open via `BroadcastChannel` shows the "already open"
message without needing a round trip.
