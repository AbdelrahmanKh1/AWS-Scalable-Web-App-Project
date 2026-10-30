'use strict';

const { loadConfig } = require('./config');
const { createDb } = require('./db');
const { createMetadataClient } = require('./metadata');
const { createApp } = require('./app');
const { log } = require('./logger');

const config = loadConfig();
const db = createDb(config.db, { region: config.region, log });
const metadata = createMetadataClient();
const app = createApp({ db, metadata });

const server = app.listen(config.port, '0.0.0.0', () => {
  log('info', 'server listening', { port: config.port });
  db.start();
});

// Graceful shutdown. The Auto Scaling Group and the ALB send SIGTERM on scale-in.
// Stop accepting new connections, let in-flight requests finish, then close the pool.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', 'shutting down', { signal });
  const forceExit = setTimeout(() => {
    log('error', 'forced exit after timeout');
    process.exit(1);
  }, config.shutdownTimeoutMs);
  forceExit.unref();
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => log('error', 'unhandled rejection', { error: String(err) }));
