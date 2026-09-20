# Multi-Channel Alarm Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-created alarm channels with one renewable browser lease per channel, strict backend scoping, and immediate scheduler/audio shutdown when ownership is lost.

**Architecture:** PostgreSQL owns channel identity, lease arbitration, constraints, and direct-API permissions. Express exposes the only application API, reuses one lease helper as middleware, and scopes every alarm query by channel. React conditionally mounts the existing alarm application only after a `sessionStorage`-backed channel session has acquired a lease; native `BroadcastChannel` supplies same-browser duplicate-tab UX.

**Tech Stack:** PostgreSQL/Supabase, `@supabase/supabase-js`, Express 5, TypeScript, React 19, native Web Storage/BroadcastChannel/Web Audio APIs, Node built-in test facilities, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-18-channel-lock-design.md`

## Global Constraints

- Lease duration is exactly 30 seconds and renewal cadence is approximately 10 seconds.
- All lock decisions use PostgreSQL `now()` through `public.acquire_channel_lock(uuid, text)`.
- The channel token travels only in `X-Channel-Token`; never return it from an API or place it in a URL.
- Normal channel and alarm use remains anonymous; templates and audio retain their current anonymous Express behavior.
- Templates remain global and contain only `h`, `m`, `s`, `audioId`, and `audioDisplayName`.
- No force unlock, cascade delete, cron cleanup, router dependency, state library, or new runtime package.
- Preserve unrelated dirty working-tree files, especially `node_modules`, frontend audit artifacts, and in-progress frontend edits.
- Use `SUPABASE_SECRET_KEY`; never expose it through a `VITE_` variable or browser bundle.
- Database verification targets the linked production project; never run `db reset --linked`, `migration repair`, or `db push --include-seed`.
- Before the first production push, confirm a current Dashboard backup and confirm both the existing and replacement backend deployments use a server-only Supabase Secret Key.

---

### Task 1: Database migration, grants, and server key naming

**Files:**
- Create via Supabase CLI: `supabase/migrations/*_channel_lock.sql` (use the exact filename printed by `supabase migration new channel_lock`)
- Modify: `schema.sql`
- Modify: `backend/src/config.ts`
- Modify: `backend/src/db.ts`
- Modify: `backend/.env.example`
- Modify: `render.yaml`

**Interfaces:**
- Produces: `public.channels`, `alarms.channel_id`, and `public.acquire_channel_lock(p_channel_id uuid, p_token text) returns table(ok boolean, expires_at timestamptz)`.
- Produces: backend-only `SUPABASE_SECRET_KEY` configuration.

- [ ] **Step 1: Generate the migration file with the Supabase CLI**

Run from the repository root; do not invent a timestamped filename:

```powershell
npx supabase@2 --help
npx supabase@2 init
npx supabase@2 migration new channel_lock
```

Expected: the last command prints a new file under `supabase/migrations/`.

- [ ] **Step 2: Write the migration**

Put this transaction in the CLI-generated file:

```sql
begin;

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lock_token text,
  lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint channels_lock_pair check (
    (lock_token is null) = (lock_expires_at is null)
  )
);

create unique index channels_name_unique_ci
  on public.channels (lower(trim(name)));

insert into public.channels (name) values ('General');

alter table public.alarms add column channel_id uuid;
update public.alarms
set channel_id = (select id from public.channels where name = 'General')
where channel_id is null;
do $$
declare
  v_general_id uuid;
begin
  select id into v_general_id from public.channels where name = 'General';
  execute format(
    'alter table public.alarms alter column channel_id set default %L::uuid',
    v_general_id
  );
end;
$$;
alter table public.alarms alter column channel_id set not null;
alter table public.alarms add constraint alarms_channel_id_fkey
  foreign key (channel_id) references public.channels(id) on delete restrict;
create index alarms_channel_id_idx on public.alarms(channel_id);

create or replace function public.acquire_channel_lock(
  p_channel_id uuid,
  p_token text
) returns table (ok boolean, expires_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_channel public.channels%rowtype;
  v_expires_at timestamptz;
begin
  select * into v_channel
  from public.channels
  where id = p_channel_id
  for update;

  if v_channel.id is null then
    return query select false, null::timestamptz;
    return;
  end if;

  if v_channel.lock_token is null
     or v_channel.lock_expires_at < now()
     or v_channel.lock_token = p_token then
    update public.channels
    set lock_token = p_token,
        lock_expires_at = now() + interval '30 seconds'
    where id = p_channel_id
    returning lock_expires_at into v_expires_at;
    return query select true, v_expires_at;
    return;
  end if;

  return query select false, null::timestamptz;
end;
$$;

revoke all on table public.channels, public.alarms, public.templates
  from anon, authenticated;
alter table public.channels enable row level security;
drop policy if exists "Enable all access for all users" on public.alarms;
drop policy if exists "Enable all access for all users" on public.templates;
revoke execute on function public.acquire_channel_lock(uuid, text)
  from public, anon, authenticated;
grant select, insert, update, delete on table public.channels, public.alarms, public.templates
  to service_role;
grant execute on function public.acquire_channel_lock(uuid, text)
  to service_role;

commit;
```

Mirror the final table, column/default, index, function, RLS, and grant definitions into `schema.sql` so a clean installation matches the migration. The General default is deliberate deployment compatibility: the currently deployed backend does not send `channel_id`, so writes remain valid until the new backend/frontend rollout is complete.

- [ ] **Step 3: Rename the backend secret variable**

Use one name everywhere:

```ts
// backend/src/config.ts
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
```

```ts
// backend/src/db.ts
import { SUPABASE_URL, SUPABASE_SECRET_KEY } from './config';
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
}
export default createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
```

Add to `backend/.env.example` and rename the Render variable:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
# Server-only sb_secret_ key. Never expose through VITE_ variables.
SUPABASE_SECRET_KEY=sb_secret_replace_me
```

- [ ] **Step 4: Link and preflight the production project**

```powershell
npx supabase@2 login
$projectUrl = (Get-Content backend/.env | Where-Object { $_ -match '^SUPABASE_URL=' }) -replace '^SUPABASE_URL=', ''
$projectRef = ([uri]$projectUrl).Host.Split('.')[0]
npx supabase@2 link --project-ref $projectRef
npx supabase@2 projects list
npx supabase@2 migration list --linked
```

The user performs the browser login and confirms the listed linked project is the production project used by the backend. If migration history diverges, stop and investigate; do not run `migration repair` automatically.

- [ ] **Step 5: Confirm rollback prerequisites and preview the push**

Before continuing, the user confirms a fresh backup exists in Supabase Dashboard → Database → Backups and that Render has a valid server-only Secret Key available under both the currently deployed variable name and `SUPABASE_SECRET_KEY` for the transition.

```powershell
npx supabase@2 db push --linked --dry-run
```

Expected: only the CLI-generated channel-lock migration is pending. Stop if any additional migration would be applied.

- [ ] **Step 6: Apply and verify the linked migration**

```powershell
npx supabase@2 db push --linked
npx supabase@2 migration list --linked
npx supabase@2 db lint --linked --schema public --fail-on error
```

Expected: the channel-lock migration appears in both local and remote columns, lint reports no errors, `General` exists, and existing alarm creation still works through the deployed backend because `channel_id` defaults to General.

- [ ] **Step 7: Build the backend**

Run: `npm run build` from `backend/`.

Expected: PASS with no reference to `SUPABASE_KEY`.

- [ ] **Step 8: Commit**

```powershell
git add supabase schema.sql backend/src/config.ts backend/src/db.ts backend/.env.example render.yaml
git commit -m "feat: add channel lease schema"
```

### Task 2: Channel API and shared lease enforcement

**Files:**
- Create: `backend/src/services/channelLease.ts`
- Create: `backend/src/middleware/channelLease.ts`
- Create: `backend/src/routes/channels.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/tests/channel-lock.integration.mjs`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `renewChannelLease(channelId: string, token: string): Promise<{ ok: boolean; expiresAt: string | null }>`.
- Produces: `requireChannelLease(paramName?: 'channelId' | 'id')` and `ChannelRequest` with `channelId` and `channelToken`.
- Produces: `GET/POST /api/channels`, `POST /api/channels/:id/lock`, `POST /api/channels/:id/unlock`, `PATCH /api/channels/:id`, and `DELETE /api/channels/:id`.

- [ ] **Step 1: Add the failing integration test shell**

Create `backend/tests/channel-lock.integration.mjs` using built-in assertions and fetch:

```js
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const api = process.env.TEST_API_URL ?? 'http://127.0.0.1:4000/api';
const { SUPABASE_URL, SUPABASE_SECRET_KEY, TEST_SUPABASE_PUBLISHABLE_KEY } = process.env;
assert.ok(SUPABASE_URL && SUPABASE_SECRET_KEY && TEST_SUPABASE_PUBLISHABLE_KEY);
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const tokenA = crypto.randomUUID();
const tokenB = crypto.randomUUID();
const server = spawn(process.execPath, ['dist/server.js'], { env: process.env, stdio: 'inherit' });
let ready = false;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    ready = (await fetch(`${api.replace(/\/api$/, '')}/health`)).ok;
    if (ready) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}
assert.equal(ready, true, 'backend did not become healthy');

const create = await fetch(`${api}/channels`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: `integration-${crypto.randomUUID()}` }),
});
assert.equal(create.status, 201);
const channel = await create.json();
const lock = (token) => fetch(`${api}/channels/${channel.id}/lock`, {
  method: 'POST', headers: { 'X-Channel-Token': token },
});
const results = await Promise.all([lock(tokenA), lock(tokenB)]);
assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);

const winner = results[0].status === 200 ? tokenA : tokenB;
const loser = winner === tokenA ? tokenB : tokenA;
assert.equal((await lock(winner)).status, 200);

await admin.from('channels').update({ lock_expires_at: new Date(0).toISOString() }).eq('id', channel.id);
assert.equal((await lock(loser)).status, 200);
assert.equal((await lock(winner)).status, 409);

const directRpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/acquire_channel_lock`, {
  method: 'POST',
  headers: { apikey: TEST_SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ p_channel_id: channel.id, p_token: crypto.randomUUID() }),
});
assert.ok([401, 403, 404].includes(directRpc.status));

await admin.from('channels').delete().eq('id', channel.id);
server.kill();
console.log('channel lock integration checks passed');
```

Wrap the assertions in `try/finally` so `server.kill()` and database cleanup run on failures. Add `"test:integration": "npm run build && node --env-file=.env tests/channel-lock.integration.mjs"` to `backend/package.json`, and add the safe-to-expose `TEST_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me` to `backend/.env.example`.

- [ ] **Step 2: Run the test and verify it fails**

Run against the linked production Supabase project. The test starts the compiled backend locally, uses a UUID-suffixed channel, and must execute its alarm/channel cleanup in `finally`:

```powershell
npm run test:integration
```

Expected: FAIL because `/api/channels` does not exist, with no `integration-` channel left behind. If cleanup fails, delete only the exact UUID-suffixed test channel through the admin client before continuing.

- [ ] **Step 3: Implement the single lease helper and middleware**

`channelLease.ts` must call only the RPC and normalize its result:

```ts
export async function renewChannelLease(channelId: string, token: string) {
  const { data, error } = await supabase.rpc('acquire_channel_lock', {
    p_channel_id: channelId,
    p_token: token,
  });
  if (error) throw error;
  const result = data?.[0];
  return { ok: result?.ok === true, expiresAt: result?.expires_at ?? null };
}
```

The middleware factory reads `req.params[paramName]`, rejects missing tokens with `400`, missing channels with `404`, and lost leases with `409`; on success it assigns `req.channelId` and `req.channelToken`. Alarm routes use `requireChannelLease()` and rename/delete routes use `requireChannelLease('id')`.

- [ ] **Step 4: Implement channel routes**

Use `z.string().uuid()` for IDs, `z.string().trim().min(1).max(60)` for names, select only `id,name,lock_expires_at`, and map status without exposing `lock_token`. `PATCH` must use `requireChannelLease` and exists solely to satisfy the spec's rename requirement. `DELETE` must call the same middleware before deleting and map PostgreSQL `23503` to `409`; when FK rejection or another delete error leaves the channel row intact, conditionally clear the lease with both `id` and the caller's token before returning so a failed delete does not lock the picker for 30 seconds.

Mount once in `server.ts`:

```ts
app.use('/api/channels', channelsRouter);
```

- [ ] **Step 5: Run checks**

Run `npm run build`, then `npm run test:integration` from `backend/`.

Expected: both PASS; the race produces one `200` and one `409`.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/services/channelLease.ts backend/src/middleware/channelLease.ts backend/src/routes/channels.ts backend/src/server.ts backend/tests/channel-lock.integration.mjs backend/package.json
git commit -m "feat: add channel lease API"
```

### Task 3: Scope alarm CRUD and neutralize template payloads

**Files:**
- Modify: `backend/src/routes/alarms.ts`
- Modify: `backend/src/server.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/context/AlarmsContext.tsx`
- Extend test: `backend/tests/channel-lock.integration.mjs`

**Interfaces:**
- Consumes: `requireChannelLease` and `ChannelRequest` from Task 2.
- Produces: `/api/channels/:channelId/alarms` CRUD; no legacy `/api/alarms` mount.
- Produces: `TemplateItem = Pick<AlarmItem, 'h' | 'm' | 's' | 'audioId' | 'audioDisplayName'>`.

- [ ] **Step 1: Extend the failing integration test**

After takeover by `loser`, add one create request with each token and assert isolation:

```js
const alarmBody = { h: 9, m: 30, s: 0, audioId: null, audioDisplayName: '' };
const createAlarm = (token) => fetch(`${api}/channels/${channel.id}/alarms`, {
  method: 'POST',
  headers: { 'X-Channel-Token': token, 'content-type': 'application/json' },
  body: JSON.stringify(alarmBody),
});
assert.equal((await createAlarm(winner)).status, 409);
const alarmResponse = await createAlarm(loser);
assert.equal(alarmResponse.status, 201);
const alarm = await alarmResponse.json();
```

Delete the alarm through the scoped endpoint before deleting the channel during cleanup.

- [ ] **Step 2: Run the integration test and verify it fails**

Expected: FAIL with `404` for the nested alarms route.

- [ ] **Step 3: Move and scope every alarm route**

Mount the router as:

```ts
app.use('/api/channels/:channelId/alarms', requireChannelLease, alarmsRouter);
```

Enable `{ mergeParams: true }`, remove `cleanupStaleAlarms`, add `channel_id: req.channelId` on inserts, and append `.eq('channel_id', req.channelId)` to list, update, single delete, and clear-all queries. Return `404` when scoped update/delete selects no row.

- [ ] **Step 4: Make templates channel-neutral**

Add the explicit type:

```ts
export type TemplateItem = Pick<AlarmItem, 'h' | 'm' | 's' | 'audioId' | 'audioDisplayName'>;
export interface Template { name: string; items: TemplateItem[]; }
```

Project before saving:

```ts
const templateItems = items.map(({ h, m, s, audioId, audioDisplayName }) => ({
  h, m, s, audioId, audioDisplayName,
}));
await API.saveTemplate(name, templateItems);
```

- [ ] **Step 5: Run backend integration and both builds**

Run `npm run test:integration` and `npm run build` in `backend/`, then `npm run build` in `frontend/`.

Expected: all PASS and `rg "app.use\('/api/alarms'" backend/src` returns no match.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/routes/alarms.ts backend/src/server.ts backend/tests/channel-lock.integration.mjs frontend/src/types/index.ts frontend/src/context/AlarmsContext.tsx
git commit -m "feat: scope alarms to channel leases"
```

### Task 4: Frontend channel session and API plumbing

**Files:**
- Create: `frontend/src/services/channelSession.ts`
- Create: `frontend/src/context/ChannelContext.tsx`
- Create: `frontend/src/pages/ChannelPicker.tsx`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/utils/audio.ts`
- Modify: `frontend/src/context/AlarmsContext.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/channel-lock.spec.ts`

**Interfaces:**
- Produces: `Channel`, `ChannelSession`, and `useChannel()` with `status`, `session`, `channels`, `selectChannel`, `createChannel`, `leaveChannel`, `renameChannel`, `deleteChannel`, and `refreshChannels`.
- Consumes: channel endpoints from Task 2 and nested alarm endpoints from Task 3.

- [ ] **Step 1: Write the failing picker test**

Mock `GET /api/channels` with one free channel, assert the picker appears, click the channel, fulfill lock acquisition, and assert `Scheduled Alarms` appears. Also assert the lock request contains `X-Channel-Token` and that `sessionStorage` contains `channelId`. Add picker tests that create a trimmed channel, delete an empty channel with a fresh token, and surface `409` without removing a non-empty channel.

```ts
await page.route('**/api/channels', route => route.fulfill({ json: [
  { id: '11111111-1111-4111-8111-111111111111', name: 'General', locked: false, expiresAt: null },
] }));
await page.route('**/api/channels/*/lock', route => {
  expect(route.request().headers()['x-channel-token']).toBeTruthy();
  return route.fulfill({ json: { expiresAt: new Date(Date.now() + 30_000).toISOString() } });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:e2e -- channel-lock.spec.ts`.

Expected: FAIL because the channel picker is absent.

- [ ] **Step 3: Add the shared playback cancellation primitive**

Implement cancellation before `ChannelContext` imports it. Do not add a controller class:

```ts
export type PlaybackResult = 'audio' | 'beep' | 'failed' | 'cancelled';
let cancelCurrent: (() => void) | null = null;
export function stopAlarm() {
  cancelCurrent?.();
  cancelCurrent = null;
}
```

For `HTMLAudioElement`, cancellation pauses, clears `src`, and settles the promise as `'cancelled'`. For the beep fallback, it clears the timeout, closes the active `AudioContext`, and settles as `'cancelled'`. A completion handler clears `cancelCurrent` only when it still owns the active playback.

- [ ] **Step 4: Add channel API functions and scoped alarm arguments**

Define one header helper:

```ts
const channelHeaders = (token: string) => ({ 'X-Channel-Token': token });
```

Change alarm functions to accept `ChannelSession` and address `/channels/${channelId}/alarms`. Add channel list/create/lock/unlock/rename/delete functions; only create/rename send JSON bodies.

- [ ] **Step 5: Implement session persistence and lease lifecycle**

Store exactly one JSON object under `alarm:channel-session` in `sessionStorage`. `ChannelContext` must:

- probe the stored session through the lock endpoint before setting `status: 'active'`;
- renew every 10 seconds even while hidden;
- set `status: 'checking'` on visibility regain, renew, then restore `active`;
- on any renewal failure call `stopAlarm()`, clear the interval/storage, and return to `idle`;
- before restoring a stored session, send `{ type: 'probe', channelId, instanceId }`, wait 150ms for an existing tab's `{ type: 'occupied', channelId, instanceId }`, and clear the cloned session instead of renewing when occupied; never transmit the token;
- answer probes only while active on the same channel, using `BroadcastChannel('alarm-channel-owner')`; simultaneous tabs with different tokens still rely on the server race as the authority;
- poll channel status every four seconds only while the picker is mounted.

- [ ] **Step 6: Implement the picker and conditional app composition**

`App` must mount `AlarmsProvider` only for an active session:

```tsx
<ChannelProvider>
  <ChannelGate />
</ChannelProvider>
```

`ChannelGate` renders a loading state for `checking`, `ChannelPicker` for `idle`, and `<AlarmsProvider session={session}><Home /></AlarmsProvider>` for `active`.

Update `AlarmsProvider` to accept `session: ChannelSession` and pass that session to every scoped alarm API call.

ChannelPicker must expose create and delete actions. Delete generates a fresh token, sends it in `X-Channel-Token`, and refreshes the list after either success or a displayed `409` error.

- [ ] **Step 7: Run tests and build**

Run `npm run test:e2e -- channel-lock.spec.ts` and `npm run build` from `frontend/`.

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/services/channelSession.ts frontend/src/context/ChannelContext.tsx frontend/src/pages/ChannelPicker.tsx frontend/src/services/api.ts frontend/src/utils/audio.ts frontend/src/context/AlarmsContext.tsx frontend/src/App.tsx frontend/tests/channel-lock.spec.ts
git commit -m "feat: add channel selection and lease renewal"
```

### Task 5: Cancellable playback, scheduler gating, and Home controls

**Files:**
- Modify: `frontend/src/hooks/useScheduler.ts`
- Modify: `frontend/src/pages/Home.tsx`
- Modify: `frontend/src/context/AlarmsContext.tsx`
- Extend test: `frontend/tests/channel-lock.spec.ts`

**Interfaces:**
- Consumes: `stopAlarm()` and cancellable playback from Task 4, plus `useChannel().status`, `leaveChannel()`, and `renameChannel()`.

- [ ] **Step 1: Write failing browser tests**

Add tests that mock a successful initial lock followed by `409`, then assert Home disappears and the picker returns. Patch `window.Audio` in `addInitScript`, trigger a due alarm, fail renewal, and assert the fake audio's `pause()` was called. Add a Home rename test asserting `PATCH /api/channels/:id` carries the token header and updates the displayed name. Open a second page in the same browser context with a cloned session, assert the first page answers the BroadcastChannel probe, and assert the second page returns to the picker without sending a renew request.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:e2e -- channel-lock.spec.ts`.

Expected: FAIL because playback cannot be cancelled and Home has no leave/rename controls.

- [ ] **Step 3: Gate scheduling on active ownership**

Add `enabled: boolean` to `useScheduler`. When false, skip checks, clear the interval, and call `stopAlarm()`. Do not call `markPlayed` when playback returns `'cancelled'`.

- [ ] **Step 4: Add current-channel controls**

Home displays the channel name, an inline rename action using the existing lease, and `Unlock / Leave this channel`. Leaving calls `stopAlarm()` before the API, then clears local session state even if the best-effort unlock request fails.

- [ ] **Step 5: Run frontend verification**

Run `npm run test:e2e -- channel-lock.spec.ts`, `npm run test:e2e`, `npm run lint`, and `npm run build`.

Expected: all PASS; lease loss returns to the picker and pauses active audio.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/hooks/useScheduler.ts frontend/src/pages/Home.tsx frontend/src/context/AlarmsContext.tsx frontend/tests/channel-lock.spec.ts
git commit -m "feat: stop alarms when channel lease is lost"
```

### Task 6: Final security and regression verification

**Files:**
- Modify: `frontend/tests/smoke.spec.ts`
- Modify: `backend/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all database, API, and frontend interfaces from Tasks 1-5.
- Produces: updated operational instructions and a green end-to-end verification record.

- [ ] **Step 1: Update existing smoke mocks without replacing unrelated edits**

Mock channel selection before dashboard assertions and replace `**/api/alarms` with `**/api/channels/*/alarms`. Keep every existing accessibility and viewport assertion.

- [ ] **Step 2: Document configuration and known security boundary**

Document `SUPABASE_URL`, server-only `SUPABASE_SECRET_KEY`, migration application, and the fact that normal channel/alarm use plus current template/audio Express endpoints remain anonymous by product decision. Remove stale SQLite claims from `backend/README.md`.

- [ ] **Step 3: Run database advisors and migration checks**

```powershell
npx supabase@2 db advisors --linked
npx supabase@2 db lint --linked --schema public --fail-on error
npx supabase@2 migration list --linked
```

Expected: no security/performance finding introduced by `channels`, the RPC, or its grants; migration histories match.

- [ ] **Step 4: Run the complete verification set**

```powershell
Set-Location backend
npm run build
npm run test:integration
Set-Location ..\frontend
npm run lint
npm run build
npm run test:e2e
```

Expected: every command exits `0`.

- [ ] **Step 5: Verify secrets and legacy routes are absent**

```powershell
rg "\bSUPABASE_KEY\b|VITE_SUPABASE_SECRET|app.use\('/api/alarms'" backend frontend render.yaml
```

Expected: no matches.

- [ ] **Step 6: Review only intended files and commit**

```powershell
git status --short
git diff --check
git add frontend/tests/smoke.spec.ts backend/README.md README.md
git commit -m "docs: document channel lock operations"
```

Do not stage pre-existing `node_modules`, audit output, or unrelated frontend work.
