#!/bin/bash
# Compute Engine startup script: runs as root on every boot. Installs what the server needs (once)
# and prepares directories. Configuration and releases are pushed later by push-config.sh/release.sh.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! command -v node >/dev/null || ! node --version | grep -q '^v24\.'; then
  apt-get update
  apt-get install -y curl gnupg ca-certificates sqlite3 debian-keyring debian-archive-keyring apt-transport-https
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

id graphspace >/dev/null 2>&1 || useradd --system --home /var/lib/graphspace --shell /usr/sbin/nologin graphspace
mkdir -p /opt/graphspace/releases /opt/graphspace/bin /opt/graphspace/etc /var/lib/graphspace /etc/graphspace
chown graphspace:graphspace /var/lib/graphspace
chmod 750 /var/lib/graphspace
touch /etc/graphspace/.provisioned
