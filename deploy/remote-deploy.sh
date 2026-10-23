#!/bin/bash
# Runs on the instance (via SSM): install release <sha> from S3, switch to it, health-check, roll back on failure.
set -euo pipefail
SHA=${1:?release id}
BUCKET=$(cat /etc/graphspace/bucket)
ROOT=/opt/graphspace
REL=$ROOT/releases/$SHA

if [ ! -d "$REL" ]; then
  TMP=$(mktemp)
  aws s3 cp "s3://$BUCKET/releases/$SHA.tgz" "$TMP" --only-show-errors
  mkdir -p "$REL"
  tar -xzf "$TMP" -C "$REL"
  rm -f "$TMP"
fi

INVITE=$(aws ssm get-parameter --name /graphspace/invite-code --with-decryption --query Parameter.Value --output text)
umask 027
printf 'INVITE_CODE=%s\n' "$INVITE" > /etc/graphspace/env
chown root:graphspace /etc/graphspace/env

PREV=$(readlink -f "$ROOT/current" 2>/dev/null || true)
ln -sfn "$REL" "$ROOT/current.new" && mv -T "$ROOT/current.new" "$ROOT/current"
systemctl restart graphspace

for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
    echo "deployed $SHA"
    # keep the five newest releases
    ls -1dt "$ROOT"/releases/* | tail -n +6 | xargs -r rm -rf
    exit 0
  fi
  sleep 1
done

echo "health check failed for $SHA" >&2
if [ -n "$PREV" ] && [ "$PREV" != "$REL" ]; then
  ln -sfn "$PREV" "$ROOT/current.new" && mv -T "$ROOT/current.new" "$ROOT/current"
  systemctl restart graphspace
  echo "rolled back to $(basename "$PREV")" >&2
fi
exit 1
