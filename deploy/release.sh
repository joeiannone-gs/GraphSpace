#!/bin/bash
# Build, upload and deploy the current commit. Needs AWS credentials for the project's Region and
# the stack outputs: GS_BUCKET, GS_INSTANCE_ID (see deploy/README.md).
set -euo pipefail
: "${GS_BUCKET:?set GS_BUCKET (pulumi stack output bucketName)}"
: "${GS_INSTANCE_ID:?set GS_INSTANCE_ID (pulumi stack output instanceId)}"
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then echo "Commit your changes first." >&2; exit 1; fi
SHA=$(git rev-parse --short=12 HEAD)
npm ci
npm run build
TGZ=$(mktemp --suffix .tgz)
tar -czf "$TGZ" -C .next/standalone .
aws s3 cp "$TGZ" "s3://$GS_BUCKET/releases/$SHA.tgz" --only-show-errors
rm -f "$TGZ"
CMD=$(aws ssm send-command --instance-ids "$GS_INSTANCE_ID" --document-name AWS-RunShellScript \
  --comment "GraphSpace deploy $SHA" --parameters "commands=[\"/opt/graphspace/bin/remote-deploy.sh $SHA\"]" \
  --query Command.CommandId --output text)
echo "deploying $SHA (command $CMD)…"
aws ssm wait command-executed --command-id "$CMD" --instance-id "$GS_INSTANCE_ID" || true
aws ssm get-command-invocation --command-id "$CMD" --instance-id "$GS_INSTANCE_ID" --query '[Status, StandardOutputContent, StandardErrorContent]' --output text
