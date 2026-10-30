#!/bin/bash
# EC2 user data for the Launch Template (Amazon Linux 2023).
# Installs Node.js, fetches the app from GitHub, writes its configuration and starts it as a
# systemd service on port 8080. Runs once at first boot of every instance the ASG launches.
set -euxo pipefail

# ---- Edit these values (or have your infrastructure code template them in) -----------------
REPO_URL="https://github.com/AbdelrahmanKh1/AWS-Scalable-Web-App-Project.git"
REPO_REF="main"                          # a branch or a tag; prefer a tag for repeatable launches
AWS_REGION="REPLACE_WITH_REGION"         # for example eu-central-1
DB_HOST="REPLACE_WITH_RDS_ENDPOINT"      # the RDS endpoint hostname
DB_NAME="appdb"
DB_SECRET_ARN="REPLACE_WITH_SECRET_ARN"  # Secrets Manager secret with username and password
NODE_PACKAGE="nodejs20"                  # confirm the name on the AMI with: dnf search nodejs
# ---------------------------------------------------------------------------------------------

APP_ROOT=/opt/project1-app

dnf install -y git "${NODE_PACKAGE}"

id appsvc &>/dev/null || useradd --system --home-dir "${APP_ROOT}" --shell /sbin/nologin appsvc

rm -rf "${APP_ROOT}"
mkdir -p "${APP_ROOT}/certs"
git clone --depth 1 --branch "${REPO_REF}" "${REPO_URL}" "${APP_ROOT}/repo"

cd "${APP_ROOT}/repo/app"
npm ci --omit=dev

# RDS CA bundle, so the app can verify the database certificate (DB_SSL=true)
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  -o "${APP_ROOT}/certs/rds-global-bundle.pem"

cat > /etc/project1-app.env <<ENVEOF
NODE_ENV=production
PORT=8080
AWS_REGION=${AWS_REGION}
DB_HOST=${DB_HOST}
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_SECRET_ARN=${DB_SECRET_ARN}
DB_SSL=true
DB_SSL_CA_PATH=${APP_ROOT}/certs/rds-global-bundle.pem
ENVEOF
chmod 600 /etc/project1-app.env

chown -R appsvc:appsvc "${APP_ROOT}"
install -m 644 "${APP_ROOT}/repo/deploy/project1-app.service" /etc/systemd/system/project1-app.service
systemctl daemon-reload
systemctl enable --now project1-app

# Fail the boot script loudly if the app never comes up (visible in /var/log/cloud-init-output.log)
for _ in $(seq 1 30); do
  if curl -fsS http://localhost:8080/health; then exit 0; fi
  sleep 2
done
echo "project1-app did not become healthy" >&2
journalctl -u project1-app --no-pager -n 50 >&2
exit 1
