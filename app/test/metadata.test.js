'use strict';

// Checks the IMDSv2 flow against a fake metadata server: a token must be requested with PUT
// first, and metadata requests without that token are rejected (as on an instance with IMDSv2 required).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createMetadataClient } = require('../src/metadata');

const TOKEN = 'test-token-123';
let server;
let baseUrl;
let tokenRequests = 0;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.method === 'PUT' && req.url === '/latest/api/token') {
      tokenRequests += 1;
      assert.equal(req.headers['x-aws-ec2-metadata-token-ttl-seconds'], '21600');
      res.end(TOKEN);
      return;
    }
    if (req.headers['x-aws-ec2-metadata-token'] !== TOKEN) {
      res.statusCode = 401;
      res.end();
      return;
    }
    if (req.url === '/latest/meta-data/instance-id') return res.end('i-0123456789abcdef0\n');
    if (req.url === '/latest/meta-data/placement/availability-zone') return res.end('eu-central-1b\n');
    res.statusCode = 404;
    return res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));

test('reads instance ID and AZ using an IMDSv2 token, and caches the result', async () => {
  const client = createMetadataClient({ baseUrl });
  const first = await client.getInstanceInfo();
  assert.deepEqual(first, {
    instanceId: 'i-0123456789abcdef0',
    availabilityZone: 'eu-central-1b',
    source: 'imds',
  });
  const before = tokenRequests;
  await client.getInstanceInfo();
  assert.equal(tokenRequests, before, 'second call should be served from the cache');
});

test('falls back to "local" when the metadata service is unreachable', async () => {
  const client = createMetadataClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 300 });
  const info = await client.getInstanceInfo();
  assert.deepEqual(info, { instanceId: 'local', availabilityZone: 'local', source: 'local' });
});

test('retries after the failure cache expires', async () => {
  let up = false;
  const flaky = (url, options) => (up ? fetch(url, options) : Promise.reject(new Error('down')));
  const client = createMetadataClient({ baseUrl, fetchImpl: flaky, failureTtlMs: 50 });
  assert.equal((await client.getInstanceInfo()).source, 'local');
  up = true;
  await new Promise((r) => setTimeout(r, 80));
  assert.equal((await client.getInstanceInfo()).source, 'imds');
});
