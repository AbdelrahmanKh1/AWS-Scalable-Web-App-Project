'use strict';

// Tests that do not need a database: the app must stay healthy and answer sensibly when
// PostgreSQL is unavailable.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { DbUnavailableError } = require('../src/db');
const { listen } = require('../test-support/helpers');

const downDb = {
  ping: async () => false,
  query: async () => { throw new DbUnavailableError(); },
};
const fakeMetadata = {
  getInstanceInfo: async () => ({ instanceId: 'i-0abc123', availabilityZone: 'eu-central-1a', source: 'imds' }),
};

let srv;
before(async () => { srv = await listen(createApp({ db: downDb, metadata: fakeMetadata })); });
after(async () => { await srv.close(); });

test('GET /health returns 200 even when the database is down', async () => {
  const res = await fetch(`${srv.baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /health/ready returns 503 when the database is down', async () => {
  const res = await fetch(`${srv.baseUrl}/health/ready`);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { status: 'degraded', database: false });
});

test('GET /api/info reports the instance, Availability Zone and database state', async () => {
  const res = await fetch(`${srv.baseUrl}/api/info`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.instanceId, 'i-0abc123');
  assert.equal(body.availabilityZone, 'eu-central-1a');
  assert.equal(body.database, false);
  assert.equal(typeof body.uptimeSeconds, 'number');
});

test('task routes return 503 (not 500) when the database is down', async () => {
  const res = await fetch(`${srv.baseUrl}/api/tasks`);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'database unavailable' });
});

test('invalid JSON returns 400', async () => {
  const res = await fetch(`${srv.baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'invalid JSON' });
});

test('unknown API paths return 404 JSON', async () => {
  const res = await fetch(`${srv.baseUrl}/api/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'not found' });
});

test('the status page is served and the x-powered-by header is hidden', async () => {
  const res = await fetch(`${srv.baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.match(await res.text(), /Project 1: Scalable Web App/);
});
