#!/bin/sh
# P1: docker-compose bind-mounts ./uploads and ./logs. On a fresh host Docker
# creates those host directories as root:root, so the non-root runtime user
# (appuser, uid 1001) cannot write to them — uploads and file logging fail.
# We start as root only to fix ownership of those two writable directories,
# then immediately drop privileges to appuser for the actual process.
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/uploads /app/logs
  chown -R appuser:appgroup /app/uploads /app/logs 2>/dev/null || true
  exec su-exec appuser:appgroup "$@"
fi

exec "$@"
