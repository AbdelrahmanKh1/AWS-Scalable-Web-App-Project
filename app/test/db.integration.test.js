'use strict';

// Integration tests against a real PostgreSQL server.
// Run with: TEST_DB_HOST=127.0.0.1 TEST_DB_NAME=appdb TEST_DB_USER=appuser TEST_DB_PASSWORD=... npm test
// Skipped automatically when TEST_DB_HOST is not set.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');
const { listen, waitFor } = require('../test-support/helpers');

const enabled = Boolean(process.env.TEST_DB_HOST);
const skip = enabled ? false : 'TEST_DB_HOST not set';

const dbConfig = {
  host: process.env.TEST_DB_HOST,
  port: Number(process.env.TEST_DB_PORT || 5432),
  database: process.env.TEST_DB_NAME || 'appdb',
  user: process.env.TEST_DB_USER,
  password: process.env.TEST_DB_PASSWORD,
  secretArn: null,
  ssl: false,
  sslCaPath: null,
  poolMax: 5,
};
const fakeMetadata = {
  getInstanceInfo: async () => ({ instanceId: 'i-test', availabilityZone: 'test-1a', source: 'imds' }),
};

let db;
let srv;

async function resetSchema() {
  const client = new Client(dbConfig);
  await client.connect();
  await client.query('DROP TABLE IF EXISTS tasks');
  await client.end();
}

before(async () => {
  if (!enabled) return;
  await resetSchema();
  db = createDb(dbConfig);
  await db.start();
  await waitFor(() => db.isReady());
  srv = await listen(createApp({ db, metadata: fakeMetadata }));
});

after(async () => {
  if (!enabled) return;
  await srv.close();
  await db.close();
});

const json = (res) => res.json();
const post = (path, body) =>
  fetch(`${srv.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('database is reported as ready', { skip }, async () => {
  const ready = await fetch(`${srv.baseUrl}/health/ready`);
  assert.equal(ready.status, 200);
  const info = await json(await fetch(`${srv.baseUrl}/api/info`));
  assert.equal(info.database, true);
});

test('create, list, toggle and delete a task', { skip }, async () => {
  const created = await post('/api/tasks', { title: '  Write the README  ' });
  assert.equal(created.status, 201);
  const task = await json(created);
  assert.equal(typeof task.id, 'number');
  assert.equal(task.title, 'Write the README');
  assert.equal(task.done, false);

  const list = await json(await fetch(`${srv.baseUrl}/api/tasks`));
  assert.ok(list.some((t) => t.id === task.id));

  const toggled = await json(await fetch(`${srv.baseUrl}/api/tasks/${task.id}`, { method: 'PATCH' }));
  assert.equal(toggled.done, true);

  const deleted = await fetch(`${srv.baseUrl}/api/tasks/${task.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  const again = await fetch(`${srv.baseUrl}/api/tasks/${task.id}`, { method: 'DELETE' });
  assert.equal(again.status, 404);
});

test('rejects invalid input', { skip }, async () => {
  assert.equal((await post('/api/tasks', {})).status, 400);
  assert.equal((await post('/api/tasks', { title: '   ' })).status, 400);
  assert.equal((await post('/api/tasks', { title: 'x'.repeat(201) })).status, 400);
  assert.equal((await post('/api/tasks', { title: 42 })).status, 400);
  assert.equal((await fetch(`${srv.baseUrl}/api/tasks/abc`, { method: 'PATCH' })).status, 400);
  assert.equal((await fetch(`${srv.baseUrl}/api/tasks/99999999999999999999`, { method: 'DELETE' })).status, 400);
  assert.equal((await fetch(`${srv.baseUrl}/api/tasks/2147483648`, { method: 'DELETE' })).status, 400);
  assert.equal((await fetch(`${srv.baseUrl}/api/tasks/0`, { method: 'DELETE' })).status, 400);
  assert.equal((await fetch(`${srv.baseUrl}/api/tasks/987654321`, { method: 'PATCH' })).status, 404);
});

test('SQL injection attempts are stored as plain text, not executed', { skip }, async () => {
  const evil = "'); DROP TABLE tasks; --";
  const res = await post('/api/tasks', { title: evil });
  assert.equal(res.status, 201);
  const list = await json(await fetch(`${srv.baseUrl}/api/tasks`));
  assert.ok(list.some((t) => t.title === evil));
});

test('two instances starting at the same time can both initialise the schema', { skip }, async () => {
  await resetSchema();
  const a = createDb(dbConfig);
  const b = createDb(dbConfig);
  try {
    await Promise.all([a.start(), b.start()]);
    await waitFor(() => a.isReady() && b.isReady());
    assert.equal(await a.ping(), true);
    assert.equal(await b.ping(), true);
  } finally {
    await a.close();
    await b.close();
  }
  // Restore the table for the shared instance used by the other tests.
  await db.close();
  db = createDb(dbConfig);
  await db.start();
  await waitFor(() => db.isReady());
});

test('queries return 503 after the database connection is closed', { skip }, async () => {
  const closed = createDb(dbConfig);
  await closed.start();
  await closed.close();
  await assert.rejects(() => closed.query('SELECT 1'), (err) => err.status === 503);
});
