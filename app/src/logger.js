'use strict';

// One JSON object per line: easy to read in CloudWatch Logs and to query with Logs Insights.
function log(level, message, extra = {}) {
  const line = { time: new Date().toISOString(), level, message, ...extra };
  const out = level === 'error' ? process.stderr : process.stdout;
  out.write(`${JSON.stringify(line)}\n`);
}

module.exports = { log };
