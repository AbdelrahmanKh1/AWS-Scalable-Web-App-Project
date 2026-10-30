'use strict';

// Reads the instance ID and Availability Zone from the EC2 instance metadata service (IMDSv2).
// IMDSv2 requires a session token (PUT) before any metadata request (GET), which matches the
// "IMDSv2 required" setting in the Launch Template. Outside EC2 the lookup fails fast and the
// app reports "local", so the same code runs on a laptop.
const LOCAL = { instanceId: 'local', availabilityZone: 'local', source: 'local' };

function createMetadataClient({
  baseUrl = 'http://169.254.169.254',
  timeoutMs = 1000,
  fetchImpl = fetch,
  failureTtlMs = 30000,
} = {}) {
  let cached = null;
  let cachedUntil = 0;

  async function get(path, token) {
    const res = await fetchImpl(`${baseUrl}/latest/meta-data/${path}`, {
      headers: { 'X-aws-ec2-metadata-token': token },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`IMDS ${path} returned ${res.status}`);
    return (await res.text()).trim();
  }

  async function lookup() {
    const tokenRes = await fetchImpl(`${baseUrl}/latest/api/token`, {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!tokenRes.ok) throw new Error(`IMDS token returned ${tokenRes.status}`);
    const token = await tokenRes.text();
    const [instanceId, availabilityZone] = await Promise.all([
      get('instance-id', token),
      get('placement/availability-zone', token),
    ]);
    return { instanceId, availabilityZone, source: 'imds' };
  }

  async function getInstanceInfo() {
    if (cached && Date.now() < cachedUntil) return cached;
    try {
      cached = await lookup();
      cachedUntil = Infinity; // instance ID and AZ never change for a running instance
    } catch {
      cached = LOCAL;
      cachedUntil = Date.now() + failureTtlMs; // retry soon in case IMDS was not ready at boot
    }
    return cached;
  }

  return { getInstanceInfo };
}

module.exports = { createMetadataClient };
