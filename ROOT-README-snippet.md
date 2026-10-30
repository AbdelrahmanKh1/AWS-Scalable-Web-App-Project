## Application

The repository includes a small Node.js service (Express and PostgreSQL) that makes the architecture visible: its status page shows which EC2 instance and Availability Zone served each request, and a simple task list is stored in the Multi-AZ RDS database. The ALB health check endpoint (`/health`) is deliberately independent of the database.

- Source, endpoints, configuration and local setup: [`app/README.md`](app/README.md)
- EC2 Launch Template user data and systemd unit: [`deploy/`](deploy/)
- Automated tests (Node 20 and 22, real PostgreSQL) run in GitHub Actions: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
