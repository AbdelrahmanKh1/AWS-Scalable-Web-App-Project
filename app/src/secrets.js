'use strict';

// Reads database credentials from AWS Secrets Manager.
// Works with the secret RDS creates when the master password is managed by Secrets Manager
// ({"username": "...", "password": "..."}) and with a dedicated application-user secret.
async function loadDbCredentials(secretArn, region) {
  // Required lazily so local development and tests do not load the AWS SDK.
  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
  const client = new SecretsManagerClient({ region });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secret = JSON.parse(response.SecretString);
  if (!secret.username || !secret.password) {
    throw new Error('Secret must contain "username" and "password"');
  }
  return { user: secret.username, password: secret.password };
}

module.exports = { loadDbCredentials };
