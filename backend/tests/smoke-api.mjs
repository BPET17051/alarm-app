// HTTP-only smoke test for the channel lease API. Needs no secrets.
// Usage: node tests/smoke-api.mjs https://your-backend.example.com/api
// Creates one uniquely named channel, exercises it, and always removes it again.
import assert from 'node:assert/strict';

const api = (process.argv[2] ?? process.env.TEST_API_URL ?? '').replace(/\/$/, '');
assert.ok(api, 'pass the API base URL, e.g. https://host/api');

const tokenA = crypto.randomUUID();
const tokenB = crypto.randomUUID();
const json = { 'content-type': 'application/json' };
const call = (path, { method = 'GET', token, body } = {}) =>
  fetch(`${api}${path}`, {
    method,
    headers: { ...(body ? json : {}), ...(token ? { 'X-Channel-Token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

let channelId = null;
let alarmId = null;
const step = (name) => console.log(`- ${name}`);

try {
  step('create channel');
  const created = await call('/channels', { method: 'POST', body: { name: `smoke-${crypto.randomUUID().slice(0, 8)}` } });
  assert.equal(created.status, 201, 'create channel');
  channelId = (await created.json()).id;

  step('two tokens race for the lock: exactly one wins');
  const race = await Promise.all([
    call(`/channels/${channelId}/lock`, { method: 'POST', token: tokenA }),
    call(`/channels/${channelId}/lock`, { method: 'POST', token: tokenB }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409], 'lock race');
  const winner = race[0].status === 200 ? tokenA : tokenB;
  const loser = winner === tokenA ? tokenB : tokenA;

  step('winner renews, loser is rejected');
  assert.equal((await call(`/channels/${channelId}/lock`, { method: 'POST', token: winner })).status, 200);
  assert.equal((await call(`/channels/${channelId}/alarms`, { token: loser })).status, 409);

  step('list channels never exposes the token');
  const listed = await (await call('/channels')).json();
  assert.ok(!JSON.stringify(listed).includes('lock_token'), 'lock_token leaked');
  assert.equal(listed.find((c) => c.id === channelId)?.locked, true);

  step('create, list and delete an alarm in the channel');
  const alarm = await call(`/channels/${channelId}/alarms`, {
    method: 'POST', token: winner, body: { h: 9, m: 30, s: 0, audioId: null, audioDisplayName: '' },
  });
  assert.equal(alarm.status, 201, 'create alarm');
  alarmId = (await alarm.json()).id;
  const alarms = await (await call(`/channels/${channelId}/alarms`, { token: winner })).json();
  assert.ok(alarms.some((a) => a.id === alarmId), 'alarm listed');
  assert.equal((await call(`/channels/${channelId}/alarms/${alarmId}`, { method: 'DELETE', token: winner })).status, 204);
  alarmId = null;

  step('delete is refused while alarms remain, then leave the channel');
  const again = await call(`/channels/${channelId}/alarms`, {
    method: 'POST', token: winner, body: { h: 9, m: 31, s: 0, audioId: null, audioDisplayName: '' },
  });
  assert.equal(again.status, 201);
  assert.equal((await call(`/channels/${channelId}`, { method: 'DELETE', token: winner })).status, 409);
  assert.equal((await call(`/channels/${channelId}/alarms`, { method: 'DELETE', token: winner })).status, 204);
  assert.equal((await call(`/channels/${channelId}/unlock`, { method: 'POST', token: winner })).status, 204);

  step('other token can now take the channel');
  assert.equal((await call(`/channels/${channelId}/lock`, { method: 'POST', token: loser })).status, 200);

  step('templates and audio endpoints still answer');
  assert.equal((await call('/templates')).status, 200);
  assert.equal((await call('/audio')).status, 200);

  console.log('smoke test passed');
} finally {
  if (channelId) {
    // clear leftovers with whichever token holds the lease, then remove the channel
    for (const token of [tokenA, tokenB]) {
      await call(`/channels/${channelId}/alarms`, { method: 'DELETE', token }).catch(() => undefined);
      const res = await call(`/channels/${channelId}`, { method: 'DELETE', token }).catch(() => undefined);
      if (res?.status === 204) break;
    }
  }
}
