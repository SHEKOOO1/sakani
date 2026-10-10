#!/bin/sh
# P1: docker-compose bind-mounts ./uploads and ./logs. On a fresh host Docker
# creates those host directories as root:root, so the non-root runtime user
# (appuser, uid 1001) cannot write to them — uploads and file logging fail.
# We start as root only to fix ownership of those two writable directories,
# then immediately drop privileges to appuser for the actual process.
set -e

# P0-4: if a DB TLS trust anchor is configured it MUST be present and readable
# when the container starts. Fail loudly and immediately instead of crash-looping
# later — and in no case silently connect without certificate validation
# (trustServerCertificate stays false in production).
if [ -n "${DB_SSL_CA_PATH:-}" ] && [ ! -r "$DB_SSL_CA_PATH" ]; then
  echo "❌ DB_SSL_CA_PATH='$DB_SSL_CA_PATH' is set but the CA certificate is missing/unreadable." >&2
   echo "   Mount the PEM file (e.g. ./ssl/db:/app/ssl/db:ro) so the container can read it." >&2
  exit 1
fi

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/uploads /app/logs
  chown -R appuser:appgroup /app/uploads /app/logs 2>/dev/null || true
  exec su-exec appuser:appgroup "$@"
fi

exec "$@"
