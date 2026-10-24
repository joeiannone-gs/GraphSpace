#!/bin/bash
# On the VM: install release <id> from a tarball, switch to it, health-check, roll back on failure.
#   sudo /opt/graphspace/bin/remote-deploy.sh <id> /tmp/gs-<id>.tgz
set -euo pipefail
ID=${1:?release id}
TGZ=${2:?tarball}
ROOT=/opt/graphspace
REL=$ROOT/releases/$ID

rm -rf "$REL"
mkdir -p "$REL"
tar -xzf "$TGZ" -C "$REL"
rm -f "$TGZ"

PREV=$(readlink -f "$ROOT/current" 2>/dev/null || true)
ln -sfn "$REL" "$ROOT/current.new" && mv -T "$ROOT/current.new" "$ROOT/current"
systemctl restart graphspace

for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "deployed $ID"
    ls -1dt "$ROOT"/releases/* | tail -n +6 | xargs -r rm -rf
    exit 0
  fi
  sleep 1
done

echo "health check failed for $ID" >&2
journalctl -u graphspace -n 20 --no-pager >&2 || true
if [ -n "$PREV" ] && [ "$PREV" != "$REL" ] && [ -d "$PREV" ]; then
  ln -sfn "$PREV" "$ROOT/current.new" && mv -T "$ROOT/current.new" "$ROOT/current"
  systemctl restart graphspace
  echo "rolled back to $(basename "$PREV")" >&2
fi
exit 1
