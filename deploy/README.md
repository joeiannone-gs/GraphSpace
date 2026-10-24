# Deploying GraphSpace (Google Cloud)

One small Compute Engine VM runs the app (`node server.js` from Next's standalone build) behind
Caddy, which gets the TLS certificate automatically. The database is a SQLite file on the VM's
disk, backed up nightly to Cloud Storage. Everything is plain `gcloud`; settings live in
`deploy/config.sh` (project from your gcloud config, `us-east4-c`, `e2-small`, VM `graphspace`).

Rough cost: about $19/month (e2-small ~$13, static IP ~$4, 20 GB disk ~$2).

## First time

```bash
deploy/provision.sh
```

It reserves a static IP, opens ports 80/443 for VMs tagged `graphspace` (if your account can't
create firewall rules it prints the one command to run in Cloud Shell), creates the VM, waits for
its startup script to install Node 24, Caddy and sqlite3, generates the sign-up **invite code**
(saved in `~/.config/graphspace/invite-code`), and pushes the server configuration.

Then deploy the app (from a clean checkout on Linux x86_64, because the SQLite driver is a native
module built by `npm ci`):

```bash
deploy/release.sh
```

The site is at `https://<static-ip-with-dashes>.sslip.io`. sslip.io resolves that name to the IP,
so HTTPS works without touching DNS.

## Your own hostname

Add an **A record** for e.g. `graphspace.josephiannone.com` pointing at the static IP (for
josephiannone.com that's in Squarespace's DNS settings), wait for it to resolve, then:

```bash
deploy/set-domain.sh graphspace.josephiannone.com
```

The sslip.io address keeps working too.

## Day to day

- **Deploy:** `deploy/release.sh` builds the current commit, copies it to the VM and switches to
  it. If `/api/health` doesn't answer within 40 seconds it switches back to the previous release.
  The five newest releases are kept in `/opt/graphspace/releases`.
- **Server config changes** (units, Caddy, scripts in `deploy/`): `deploy/push-config.sh`
  (release.sh does this too).
- **Shell:** `gcloud compute ssh graphspace --zone us-east4-c`.
- **Logs:** `journalctl -u graphspace -f` and `journalctl -u caddy -f` on the VM.
- **Accounts without the invite code:**
  `cd /opt/graphspace/current && sudo -u graphspace env DATABASE_PATH=/var/lib/graphspace/gs.db node cli/create-user.mjs student@example.com "Name"`
- **Change the invite code:** edit `~/.config/graphspace/invite-code`, re-run `deploy/provision.sh`,
  then `gcloud compute ssh graphspace --zone us-east4-c --command 'sudo systemctl restart graphspace'`.
- **Backups:** `graphspace-backup.timer` copies a consistent snapshot of the database to
  `gs://hft-evolve-storage-2/graphspace/backups/YYYY/MM/DD/` every night at 03:17 UTC and deletes
  ones older than 30 days. Run one now with `sudo systemctl start graphspace-backup`.
- **Restore:** `sudo systemctl stop graphspace`, copy a backup down with `gcloud storage cp`,
  `gunzip` it to `/var/lib/graphspace/gs.db` (owner `graphspace`), `sudo systemctl start graphspace`.

## Tearing down

```bash
gcloud compute instances delete graphspace --zone us-east4-c
gcloud compute addresses delete graphspace-ip --region us-east4
gcloud compute firewall-rules delete graphspace-web
```

Backups in the bucket stay until you delete them.
