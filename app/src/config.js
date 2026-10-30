'use strict';

function toBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8080),
    region: env.AWS_REGION || env.AWS_DEFAULT_REGION,
    shutdownTimeoutMs: Number(env.SHUTDOWN_TIMEOUT_MS || 10000),
    db: {
      host: env.DB_HOST || 'localhost',
      port: Number(env.DB_PORT || 5432),
      database: env.DB_NAME || 'appdb',
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      // When set, credentials are read from AWS Secrets Manager instead of DB_USER / DB_PASSWORD.
      secretArn: env.DB_SECRET_ARN || null,
      ssl: toBool(env.DB_SSL, false),
      // Path to the RDS CA bundle. Needed to verify the RDS certificate on EC2.
      sslCaPath: env.DB_SSL_CA_PATH || null,
      poolMax: Number(env.DB_POOL_MAX || 10),
    },
  };
}

module.exports = { loadConfig };
