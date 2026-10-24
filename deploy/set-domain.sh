#!/bin/bash
# Serve GraphSpace on your own hostname too, after its DNS A record points at the static IP:
#   deploy/set-domain.sh graphspace.josephiannone.com
set -euo pipefail
HOST=${1:?hostname}
cd "$(dirname "$0")"
source ./config.sh
IP=$(static_ip)
RESOLVED=$(getent ahostsv4 "$HOST" | awk 'NR==1{print $1}')
if [ "$RESOLVED" != "$IP" ]; then
  echo "$HOST resolves to '${RESOLVED:-nothing}', not $IP. Add an A record $HOST -> $IP first." >&2
  exit 1
fi
gssh "grep -qx '$HOST' /etc/graphspace/hosts || echo '$HOST' | sudo tee -a /etc/graphspace/hosts >/dev/null; sudo /opt/graphspace/bin/render-caddy.sh"
echo "https://$HOST will work once Caddy has its certificate (usually under a minute)."
