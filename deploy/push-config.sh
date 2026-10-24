#!/bin/bash
# Copy the server's configuration (systemd units, Caddy, scripts) from this repo to the VM.
set -euo pipefail
cd "$(dirname "$0")"
source ./config.sh
TMP=/tmp/graphspace-config
gssh "rm -rf $TMP && mkdir -p $TMP"
gscp graphspace.service graphspace-backup.service graphspace-backup.timer Caddyfile remote-deploy.sh backup.sh render-caddy.sh "$GS_VM:$TMP/"
gssh "set -e
  sudo install -m 644 $TMP/graphspace.service $TMP/graphspace-backup.service $TMP/graphspace-backup.timer /etc/systemd/system/
  sudo install -m 755 $TMP/remote-deploy.sh $TMP/backup.sh $TMP/render-caddy.sh /opt/graphspace/bin/
  sudo install -m 644 $TMP/Caddyfile /opt/graphspace/etc/Caddyfile.template
  echo '$GS_BACKUP_URI' | sudo tee /etc/graphspace/backup-uri >/dev/null
  sudo touch /etc/graphspace/hosts && sudo sed -i '/\.sslip\.io\$/d' /etc/graphspace/hosts && echo '$(sslip_host)' | sudo tee -a /etc/graphspace/hosts >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable --now graphspace-backup.timer
  sudo systemctl enable graphspace
  sudo /opt/graphspace/bin/render-caddy.sh
  rm -rf $TMP"
echo "configuration pushed"
