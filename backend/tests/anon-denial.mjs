// Verifies the public (anon/publishable) key cannot reach the tables or the lock RPC directly.
// Usage: node --env-file=.env tests/anon-denial.mjs
// Reads SUPABASE_URL and the public key from TEST_SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_KEY). Prints no keys.
const url = process.env.SUPABASE_URL;
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and a public key are required');
  process.exit(2);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' };
const denied = (status) => [401, 403, 404].includes(status);
const zero = '00000000-0000-0000-0000-000000000000';

const checks = [
  ['read alarms', () => fetch(`${url}/rest/v1/alarms?select=id&limit=1`, { headers })],
  ['read templates', () => fetch(`${url}/rest/v1/templates?select=id&limit=1`, { headers })],
  ['read channels', () => fetch(`${url}/rest/v1/channels?select=id&limit=1`, { headers })],
  ['insert alarm', () => fetch(`${url}/rest/v1/alarms`, {
    method: 'POST', headers, body: JSON.stringify({ h: 0, m: 0, channel_id: zero }),
  })],
  ['call lock rpc', () => fetch(`${url}/rest/v1/rpc/acquire_channel_lock`, {
    method: 'POST', headers, body: JSON.stringify({ p_channel_id: zero, p_token: 'anon-denial-check' }),
  })],
];

let failed = 0;
for (const [name, run] of checks) {
  const res = await run();
  const ok = denied(res.status);
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} -> HTTP ${res.status}`);
}
console.log(failed === 0 ? 'anon access is fully denied' : `${failed} check(s) still allow public access`);
process.exit(failed === 0 ? 0 : 1);
