# Shared settings for the deploy scripts (sourced). Override any of these in the environment.
GS_PROJECT=${GS_PROJECT:-$(gcloud config get-value project 2>/dev/null)}
GS_REGION=${GS_REGION:-us-east4}
GS_ZONE=${GS_ZONE:-us-east4-c}
GS_VM=${GS_VM:-graphspace}
GS_MACHINE=${GS_MACHINE:-e2-small}
GS_ADDRESS=${GS_ADDRESS:-graphspace-ip}
GS_FIREWALL=${GS_FIREWALL:-graphspace-web}
GS_BACKUP_URI=${GS_BACKUP_URI:-gs://hft-evolve-storage-2/graphspace/backups}
GS_SECRETS=${GS_SECRETS:-$HOME/.config/graphspace}

gssh() {
  gcloud compute ssh "$GS_VM" --project "$GS_PROJECT" --zone "$GS_ZONE" --quiet --strict-host-key-checking=no --command "$*"
}

gscp() {
  gcloud compute scp --project "$GS_PROJECT" --zone "$GS_ZONE" --quiet --strict-host-key-checking=no "$@"
}

static_ip() {
  gcloud compute addresses describe "$GS_ADDRESS" --project "$GS_PROJECT" --region "$GS_REGION" --format='value(address)'
}

# A hostname that resolves to the IP with no DNS setup (sslip.io), so HTTPS works right away.
sslip_host() {
  echo "$(static_ip | tr . -).sslip.io"
}
