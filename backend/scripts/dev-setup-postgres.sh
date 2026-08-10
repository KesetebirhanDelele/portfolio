#!/bin/bash
# Local dev helper: starts a Postgres container and writes generated secrets
# straight into backend/.env. Never prints secret values to stdout.
set -e

cd "$(dirname "$0")/.."   # -> backend/

CONTAINER_NAME="colaberry-portfolio-postgres"
DB_PORT=5434
DB_NAME="repo2reputation"

PW=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENC_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo "[dev-setup] removing any existing $CONTAINER_NAME container..."
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "[dev-setup] starting Postgres container on port $DB_PORT..."
docker run -d --name "$CONTAINER_NAME" \
  -p "127.0.0.1:${DB_PORT}:5432" \
  -e POSTGRES_PASSWORD="$PW" \
  -e POSTGRES_DB="$DB_NAME" \
  -e POSTGRES_USER=postgres \
  postgres:16-alpine >/dev/null

echo "[dev-setup] waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    echo "[dev-setup] Postgres ready after ${i}s"
    break
  fi
  sleep 1
done

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  grep -vE "^(DATABASE_URL|DB_PASSWORD|JWT_SECRET|COLABERRY_SESSION_ENCRYPTION_KEY|COLABERRY_LOGIN_URL)=" "$ENV_FILE" > "$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
else
  touch "$ENV_FILE"
fi

{
  echo "DATABASE_URL=postgres://postgres:${PW}@localhost:${DB_PORT}/${DB_NAME}"
  echo "JWT_SECRET=${JWT_SECRET}"
  echo "COLABERRY_SESSION_ENCRYPTION_KEY=${ENC_KEY}"
  echo "COLABERRY_LOGIN_URL=https://app.colaberry.com"
} >> "$ENV_FILE"

echo "[dev-setup] wrote DATABASE_URL, JWT_SECRET, COLABERRY_SESSION_ENCRYPTION_KEY, COLABERRY_LOGIN_URL to backend/.env"
echo "[dev-setup] (values not printed — check the file directly if you need to see them)"
echo "[dev-setup] done."
