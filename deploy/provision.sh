#!/bin/bash
# Create the GraphSpace server on Compute Engine (safe to re-run): static IP, firewall rule for
# HTTP/HTTPS, the VM, and the sign-up invite code. Then push the server configuration.
set -euo pipefail
cd "$(dirname "$0")"
source ./config.sh
echo "project $GS_PROJECT, zone $GS_ZONE, VM $GS_VM"

if ! gcloud compute addresses describe "$GS_ADDRESS" --project "$GS_PROJECT" --region "$GS_REGION" >/dev/null 2>&1; then
  gcloud compute addresses create "$GS_ADDRESS" --project "$GS_PROJECT" --region "$GS_REGION"
fi
echo "static IP: $(static_ip)"

FIREWALL_CMD="gcloud compute firewall-rules create $GS_FIREWALL --project $GS_PROJECT --network default --direction INGRESS --allow tcp:80,tcp:443 --source-ranges 0.0.0.0/0 --target-tags graphspace"
if ! gcloud compute firewall-rules describe "$GS_FIREWALL" --project "$GS_PROJECT" >/dev/null 2>&1; then
  if ! $FIREWALL_CMD; then
    echo
    echo "Couldn't create the firewall rule (missing permission). Run this once in Cloud Shell, then re-run provision.sh:"
    echo "  $FIREWALL_CMD"
    echo
  fi
fi

if ! gcloud compute instances describe "$GS_VM" --project "$GS_PROJECT" --zone "$GS_ZONE" >/dev/null 2>&1; then
  gcloud compute instances create "$GS_VM" \
    --project "$GS_PROJECT" --zone "$GS_ZONE" --machine-type "$GS_MACHINE" \
    --image-family ubuntu-2404-lts-amd64 --image-project ubuntu-os-cloud \
    --boot-disk-size 20GB --boot-disk-type pd-balanced \
    --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring \
    --tags graphspace --address "$GS_ADDRESS" \
    --scopes storage-rw,logging-write,monitoring-write \
    --metadata enable-oslogin=TRUE \
    --metadata-from-file startup-script=startup.sh
fi

echo -n "waiting for the VM to finish installing"
for _ in $(seq 1 60); do
  if gssh 'test -f /etc/graphspace/.provisioned' >/dev/null 2>&1; then break; fi
  echo -n .
  sleep 10
done
echo
gssh 'test -f /etc/graphspace/.provisioned' || { echo "The VM didn't finish its startup script; check: gcloud compute instances get-serial-port-output $GS_VM --zone $GS_ZONE"; exit 1; }

mkdir -p "$GS_SECRETS" && chmod 700 "$GS_SECRETS"
if [ ! -s "$GS_SECRETS/invite-code" ]; then
  python3 -c "import secrets,string;a=string.ascii_lowercase+string.digits;print('-'.join(''.join(secrets.choice(a) for _ in range(4)) for _ in range(3)))" > "$GS_SECRETS/invite-code"
  chmod 600 "$GS_SECRETS/invite-code"
fi
printf 'INVITE_CODE=%s\n' "$(cat "$GS_SECRETS/invite-code")" | gssh 'sudo install -m 640 -o root -g graphspace /dev/stdin /etc/graphspace/env'

./push-config.sh
echo
echo "Server ready at https://$(sslip_host) (deploy the app with deploy/release.sh)."
echo "Invite code: $(cat "$GS_SECRETS/invite-code")  (saved in $GS_SECRETS/invite-code)"
