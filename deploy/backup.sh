#!/bin/bash
# On the VM (nightly timer): consistent copy of the SQLite database, gzipped, to Cloud Storage;
# backups older than 30 days are deleted.
set -euo pipefail
URI=$(cat /etc/graphspace/backup-uri)
GCLOUD=$(command -v gcloud || echo /snap/bin/gcloud)
DB=/var/lib/graphspace/gs.db
[ -f "$DB" ] || { echo "no database yet"; exit 0; }
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
sqlite3 "$DB" ".backup '$TMP/gs.db'"
sqlite3 "$TMP/gs.db" 'PRAGMA integrity_check;' | grep -qx ok
gzip "$TMP/gs.db"
"$GCLOUD" storage cp "$TMP/gs.db.gz" "$URI/$(date -u +%Y/%m/%d)/gs-$STAMP.db.gz" --quiet
echo "backup ok: $STAMP"

CUTOFF=$(date -u -d '30 days ago' +%Y%m%d)
"$GCLOUD" storage ls "$URI/**" 2>/dev/null | while read -r obj; do
  d=$(echo "$obj" | sed -nE 's#.*/([0-9]{4})/([0-9]{2})/([0-9]{2})/[^/]+$#\1\2\3#p')
  if [ -n "$d" ] && [ "$d" -lt "$CUTOFF" ]; then "$GCLOUD" storage rm "$obj" --quiet; fi
done
