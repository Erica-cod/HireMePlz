#!/bin/sh
set -e

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/hiremeplz-${TIMESTAMP}.sql.gz"
S3_KEY="backups/hiremeplz-${TIMESTAMP}.sql.gz"
ENDPOINT="https://${DO_SPACES_REGION}.digitaloceanspaces.com"

echo "[$(date -u)] Starting PostgreSQL backup..."
pg_dump -h postgres -U postgres hiremeplz | gzip > "${BACKUP_FILE}"

echo "[$(date -u)] Uploading to DO Spaces: ${S3_KEY}"
aws s3 cp "${BACKUP_FILE}" "s3://${DO_SPACES_BUCKET}/${S3_KEY}" \
  --endpoint-url "${ENDPOINT}"

rm -f "${BACKUP_FILE}"
echo "[$(date -u)] Backup complete: ${S3_KEY}"
