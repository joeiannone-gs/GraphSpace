#!/bin/bash
# On the VM: write /etc/caddy/Caddyfile for every hostname in /etc/graphspace/hosts and reload Caddy.
set -euo pipefail
HOSTS=$(grep -v '^\s*$' /etc/graphspace/hosts | paste -sd, - | sed 's/,/, /g')
sed "s|__HOSTS__|$HOSTS|" /opt/graphspace/etc/Caddyfile.template > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl reload caddy || systemctl restart caddy
echo "Caddy serving: $HOSTS"
