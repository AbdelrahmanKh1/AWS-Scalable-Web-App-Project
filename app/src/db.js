'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { loadDbCredentials } = require('./secrets');

const SCHEMA = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
// Arbitrary constant. The advisory lock stops two instances that boot at the same time
// (for example during a scale-out) from racing on CREATE TABLE.
const SCHEMA_LOCK_ID = 727274;

function buildSsl(dbConfig) {
  if (!dbConfig.ssl) return false;
  if (dbConfig.sslCaPath) {
    return { ca: fs.readFileSync(dbConfig.sslCaPath, 'utf8'), rejectUnauthorized: true };
  }
  return true; // verify against the system CA store
}

class DbUnavailableError extends Error {
  constructor() {
    super('Database is not available');
    this.status = 503;
  }
}

// The app starts serving /health immediately and connects to the database in the background,
// retrying with backoff. A database outage therefore never fails the ALB health check and
// never causes the Auto Scaling Group to replace healthy instances.
function createDb(dbConfig, { region, log = () => {} } = {}) {
  let pool = null;
  let ready = false;
  let stopped = false;
  let retryTimer = null;

  async function connect() {
    let { user, password } = dbConfig;
    if (dbConfig.secretArn) {
      ({ user, password } = await loadDbCredentials(dbConfig.secretArn, region));
    }
    pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user,
      password,
      max: dbConfig.poolMax,
      ssl: buildSsl(dbConfig),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => log('error', 'database pool error', { error: err.message }));

    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_ID]);
      await client.query(SCHEMA);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_ID]).catch(() => {});
      client.release();
    }
    ready = true;
  }

  async function attempt(n) {
    try {
      await connect();
      log('info', 'database ready');
    } catch (err) {
      ready = false;
      if (pool) {
        await pool.end().catch(() => {});
        pool = null;
      }
      const delayMs = Math.min(30000, 1000 * 2 ** Math.min(n, 5));
      log('warn', 'database not ready, will retry', { attempt: n, retryInMs: delayMs, error: err.message });
      if (!stopped) {
        retryTimer = setTimeout(() => attempt(n + 1), delayMs);
        retryTimer.unref();
      }
    }
  }

  return {
    start: () => attempt(1),
    isReady: () => ready,
    async query(text, params) {
      if (!ready || !pool) throw new DbUnavailableError();
      return pool.query(text, params);
    },
    async ping() {
      if (!ready || !pool) return false;
      try {
        await pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
    async close() {
      stopped = true;
      ready = false;
      clearTimeout(retryTimer);
      if (pool) await pool.end().catch(() => {});
      pool = null;
    },
  };
}

module.exports = { createDb, DbUnavailableError };
