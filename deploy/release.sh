#!/bin/bash
# Build the current commit and deploy it to the VM (health-checked, with automatic rollback).
set -euo pipefail
cd "$(dirname "$0")"
source ./config.sh
cd ..
if [ -n "$(git status --porcelain)" ]; then echo "Commit your changes first." >&2; exit 1; fi
ID=$(git rev-parse --short=12 HEAD)
npm ci
npm run build
TGZ=$(mktemp --suffix .tgz)
tar -czf "$TGZ" -C .next/standalone .
./deploy/push-config.sh
gscp "$TGZ" "$GS_VM:/tmp/gs-$ID.tgz"
rm -f "$TGZ"
gssh "sudo /opt/graphspace/bin/remote-deploy.sh $ID /tmp/gs-$ID.tgz"
echo "live: https://$(sslip_host)"
