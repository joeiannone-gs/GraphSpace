#!/bin/bash
# Nightly: consistent online copy of the SQLite database, gzipped, to S3 (kept 30 days by lifecycle rule).
set -euo pipefail
BUCKET=$(cat /etc/graphspace/bucket)
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
sqlite3 /var/lib/graphspace/gs.db ".backup '$TMP/gs.db'"
sqlite3 "$TMP/gs.db" 'PRAGMA integrity_check;' | grep -qx ok
gzip "$TMP/gs.db"
aws s3 cp "$TMP/gs.db.gz" "s3://$BUCKET/backups/$(date -u +%Y/%m/%d)/gs-$STAMP.db.gz" --only-show-errors
echo "backup ok: $STAMP"
