'use strict';

const path = require('node:path');
const express = require('express');

const MAX_TITLE_LENGTH = 200;
const MAX_ID = 2147483647; // PostgreSQL integer (int4) upper bound

function parseId(value) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && id <= MAX_ID ? id : null;
}

function createApp({ db, metadata, startedAt = Date.now() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ALB health check. Deliberately independent of the database: if the database has a problem,
  // replacing healthy EC2 instances would not fix it and would only make things worse.
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Readiness: reports whether the database is reachable. Use it for manual checks and alarms.
  app.get('/health/ready', async (req, res) => {
    const dbOk = await db.ping();
    res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ready' : 'degraded', database: dbOk });
  });

  // Shows which instance and Availability Zone served the request.
  app.get('/api/info', async (req, res) => {
    const instance = await metadata.getInstanceInfo();
    res.json({
      instanceId: instance.instanceId,
      availabilityZone: instance.availabilityZone,
      metadataSource: instance.source,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      database: await db.ping(),
    });
  });

  app.get('/api/tasks', async (req, res) => {
    const { rows } = await db.query(
      'SELECT id, title, done, created_at FROM tasks ORDER BY id DESC LIMIT 100',
    );
    res.json(rows);
  });

  app.post('/api/tasks', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > MAX_TITLE_LENGTH) {
      return res
        .status(400)
        .json({ error: `title is required and must be at most ${MAX_TITLE_LENGTH} characters` });
    }
    const { rows } = await db.query(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done, created_at',
      [title],
    );
    return res.status(201).json(rows[0]);
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'invalid id' });
    const { rows } = await db.query(
      'UPDATE tasks SET done = NOT done WHERE id = $1 RETURNING id, title, done, created_at',
      [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'task not found' });
    return res.json(rows[0]);
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'invalid id' });
    const result = await db.query('DELETE FROM tasks WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'task not found' });
    return res.status(204).end();
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload too large' });
    if (err.status === 503) return res.status(503).json({ error: 'database unavailable' });
    return res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = { createApp };
