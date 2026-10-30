# Application

A small Node.js service that makes the architecture visible once it is deployed:

- The status page (`/`) shows **which EC2 instance and Availability Zone served the request**, whether the database is connected, and a simple task list stored in PostgreSQL. Refresh a few times and you will see the ALB spread requests across both AZs.
- `/health` is the ALB health check. It **does not depend on the database**, so a database problem never makes the ALB or the Auto Scaling Group replace healthy instances.
- `/health/ready` reports database connectivity (use it for manual checks and alarms).

Stack: Node.js 20+, Express 5, `pg`, AWS SDK v3 (Secrets Manager only).

## Endpoints

| Method | Path | Purpose | Notes |
| --- | --- | --- | --- |
| GET | `/` | Status page and task list | Static HTML |
| GET | `/health` | ALB target health check | `200 {"status":"ok"}`; no database call |
| GET | `/health/ready` | Readiness | `200` when the database responds, otherwise `503` |
| GET | `/api/info` | Instance ID, AZ, uptime, database state | Instance data comes from IMDSv2; reports `local` off EC2 |
| GET | `/api/tasks` | Latest 100 tasks | `503` if the database is unavailable |
| POST | `/api/tasks` | Create a task | Body `{"title": "..."}`, 1 to 200 characters |
| PATCH | `/api/tasks/:id` | Toggle done | `404` if the task does not exist |
| DELETE | `/api/tasks/:id` | Delete a task | `204`, or `404` |

> `/api/info` exposes the instance ID and AZ on purpose, to demonstrate load balancing. Remove or protect it if you reuse this code for anything real.

## Configuration

All configuration is through environment variables (see [`.env.example`](.env.example)).

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | Listen port (the ALB target group port) |
| `DB_HOST` | `localhost` | Database host (the RDS endpoint on AWS) |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `appdb` | Database name |
| `DB_USER`, `DB_PASSWORD` | none | Credentials for local development |
| `DB_SECRET_ARN` | none | Secrets Manager secret holding `username` and `password`. Overrides `DB_USER` and `DB_PASSWORD` |
| `AWS_REGION` | none | Region for the Secrets Manager call |
| `DB_SSL` | `false` | Set to `true` on AWS. The server certificate is verified |
| `DB_SSL_CA_PATH` | none | RDS CA bundle path, needed to verify the RDS certificate |
| `DB_POOL_MAX` | `10` | Maximum pooled connections per instance |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Forced exit if shutdown takes longer than this |

## Run locally

```bash
# 1. A local PostgreSQL (example using Docker)
docker run -d --name p1-db -p 5432:5432 \
  -e POSTGRES_USER=appuser -e POSTGRES_PASSWORD=change-me -e POSTGRES_DB=appdb postgres:16

# 2. The app
cd app
npm ci
cp .env.example .env        # edit DB_PASSWORD if you changed it
node --env-file=.env src/server.js
# open http://localhost:8080
```

The app creates its `tasks` table on startup (see [`db/schema.sql`](db/schema.sql)). It starts serving `/health` immediately and keeps retrying the database connection in the background with backoff.

## Tests

```bash
cd app
npm test                                                     # tests that need no database
TEST_DB_HOST=localhost TEST_DB_USER=appuser TEST_DB_PASSWORD=change-me TEST_DB_NAME=appdb npm test   # plus database tests
```

The suite covers the health endpoints (including with the database down), the IMDSv2 token flow against a fake metadata server, input validation, SQL-injection handling, CRUD against real PostgreSQL, and two instances initialising the schema at the same time. GitHub Actions runs it on Node 20 and 22 with a PostgreSQL service container (`.github/workflows/ci.yml`).

## Design notes

| Decision | Reason |
| --- | --- |
| `/health` never touches the database | A database incident should alert people, not trigger a replacement loop of healthy instances |
| Database connection retried in the background | An instance that boots before RDS is reachable still becomes healthy and recovers on its own |
| Advisory lock around schema creation | Instances launched together by a scale-out cannot race on `CREATE TABLE` |
| IMDSv2 only (token, then request) | Matches the Launch Template setting that requires IMDSv2 |
| Credentials from Secrets Manager | No passwords in user data, images, or the repository |
| `DB_SSL=true` with the RDS CA bundle | Encrypts and verifies the connection to RDS; no `rejectUnauthorized: false` |
| Graceful shutdown on `SIGTERM` | Scale-in and deployments finish in-flight requests before the process exits |
| JSON log lines | Easy to search with CloudWatch Logs Insights |

## Deploying to EC2

[`deploy/user-data.sh`](../deploy/user-data.sh) is the Launch Template user data for Amazon Linux 2023. It installs Node.js, clones this repository, runs `npm ci --omit=dev`, downloads the RDS CA bundle, writes `/etc/project1-app.env`, and starts the [`project1-app.service`](../deploy/project1-app.service) systemd unit. Edit the variables at the top of the script (region, RDS endpoint, secret ARN) first.

The instance role needs `secretsmanager:GetSecretValue` on the database secret (already in Step 5 of the deployment runbook), and the instance needs outbound access through the NAT Gateway to reach GitHub, the npm registry and the package repositories.
