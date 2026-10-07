#!/bin/sh
# Production backup script (run on the deploy host, e.g. via cron/systemd timer).
#
#   BACKUP_DIR=/opt/sakani/backups \
#   MSSQL_SA_PASSWORD=... \
#   scripts/backup.sh
#
# Creates a full SQL Server backup and an uploads archive, then prunes backups
# older than BACKUP_RETENTION_DAYS.
set -eu

COMPOSE_DIR="${COMPOSE_DIR:-/opt/sakani}"
BACKUP_DIR="${BACKUP_DIR:-$COMPOSE_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
DB_NAME="${DB_NAME:-DormMaster}"
STAMP="$(date +%Y%m%d_%H%M%S)"

: "${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD must be set}"

mkdir -p "$BACKUP_DIR"

# 1) SQL Server full backup inside the db container, then copy it to the host.
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db mkdir -p /var/opt/mssql/backup
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C \
  -Q "BACKUP DATABASE [$DB_NAME] TO DISK = N'/var/opt/mssql/backup/${DB_NAME}_${STAMP}.bak' WITH INIT, COMPRESSION"
docker compose -f "$COMPOSE_DIR/docker-compose.yml" cp \
  "db:/var/opt/mssql/backup/${DB_NAME}_${STAMP}.bak" "$BACKUP_DIR/${DB_NAME}_${STAMP}.bak"

# 2) Uploads archive (runtime data, bind-mounted at $COMPOSE_DIR/uploads).
tar -czf "$BACKUP_DIR/uploads_${STAMP}.tar.gz" -C "$COMPOSE_DIR" uploads

# 3) Retention.
find "$BACKUP_DIR" -type f -mtime +"$RETENTION_DAYS" -delete

echo "Backup complete: $BACKUP_DIR"
