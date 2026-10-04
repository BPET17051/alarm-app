const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getCurrentBangkokDayBounds } = require('../dist/utils/dayKey');

let rows;
let cleanupError;
let channelDeleted;
let released;
const db = {
  from(table) {
    const filters = [];
    return {
      delete() { return this; },
      eq(key, value) { filters.push(row => row[key] === value); return this; },
      lt(key, value) { filters.push(row => row[key] < value); return this; },
      then(resolve) {
        if (table === 'alarms') {
          if (cleanupError) return resolve({ error: cleanupError });
          rows = rows.filter(row => !filters.every(filter => filter(row)));
          return resolve({ error: null });
        }
        if (rows.some(row => row.channel_id === 'target')) {
          return resolve({ error: { code: '23503' } });
        }
        channelDeleted = true;
        return resolve({ error: null });
      },
    };
  },
};
for (const [path, exports] of [
  ['../dist/db', { __esModule: true, default: db }],
  ['../dist/middleware/channelLease', { requireChannelLease: () => (_req, _res, next) => next() }],
  ['../dist/services/channelLease', { releaseChannelLease: async () => { released = true; } }],
]) {
  require.cache[require.resolve(path)] = { exports };
}
const router = require('../dist/routes/channels').default;
const handler = router.stack.find(layer => layer.route?.methods.delete).route.stack.at(-1).handle;

async function removeChannel(initialRows, error = null) {
  rows = structuredClone(initialRows);
  cleanupError = error;
  channelDeleted = released = false;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send() { return this; },
  };
  await handler({ channelId: 'target', channelToken: 'test-token' }, response);
  return response;
}

test('historical alarms do not prevent channel deletion; other channels survive', async () => {
  const other = { channel_id: 'other', created_at: '2020-01-01T00:00:00.000Z' };
  const response = await removeChannel([
    { channel_id: 'target', created_at: '2020-01-01T00:00:00.000Z' }, other,
  ]);
  assert.equal(response.statusCode, 204);
  assert.equal(channelDeleted, true);
  assert.deepEqual(rows, [other]);
});

test('alarms at Bangkok midnight and later still prevent deletion', async () => {
  const { startIso, endIso } = getCurrentBangkokDayBounds();
  const current = [startIso, endIso].map(created_at => ({ channel_id: 'target', created_at }));
  const response = await removeChannel([
    { channel_id: 'target', created_at: new Date(Date.parse(startIso) - 1).toISOString() },
    ...current,
  ]);
  assert.equal(response.statusCode, 409);
  assert.equal(channelDeleted, false);
  assert.equal(released, true);
  assert.deepEqual(rows, current);
});

test('cleanup failure keeps the channel and releases its lease', async () => {
  const original = [{ channel_id: 'target', created_at: '2020-01-01T00:00:00.000Z' }];
  const response = await removeChannel(original, { message: 'database unavailable' });
  assert.equal(response.statusCode, 500);
  assert.equal(channelDeleted, false);
  assert.equal(released, true);
  assert.deepEqual(rows, original);
});
