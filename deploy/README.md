# Deploying GraphSpace

One small EC2 instance in your project's selected AWS Region runs the app (`node server.js` from
Next's standalone build) behind Caddy, which gets the TLS certificate automatically. Releases and
nightly database backups go to a private S3 bucket. There is no SSH: manage the server with SSM
Session Manager.

Rough cost: a `t3.small` with standard CPU credits plus 20 GB of gp3 and a few MB of S3 —
about $17/month (a `t3.micro` halves the instance part).

## Before you start

1. **Region.** All resources must be in your project's selected Region. Check it in
   AWS Settings > View all projects > Overview > Additional Info > Region (if you can't, look at
   `~/.aws/config`). Use that Region below.
2. **Plan and spend limit.** Run `aws freetier get-account-plan-state` to see whether the account
   is on the free or paid plan. If the project has a spend limit, make sure ~$20/month fits.
3. **Credentials.** `aws login`, then `aws sts get-caller-identity` should work.
4. **Pulumi.** Install the Pulumi CLI and `pulumi login` (Pulumi Cloud, or `pulumi login --local`).
5. **A hostname.** Pick one, e.g. `graphspace.josephiannone.com`, and know where its DNS is managed.

## First deploy

```bash
cd deploy/pulumi
npm ci
pulumi stack init prod
pulumi config set aws:region <your-region>
pulumi config set domain graphspace.josephiannone.com
pulumi config set --secret inviteCode '<something students will type>'
pulumi up
```

`pulumi up` prints `publicIp` and `dnsRecord`. Create that **A record** at your DNS provider. Caddy
requests the certificate as soon as the name resolves to the instance (first boot takes a few
minutes: it installs Node, Caddy and the AWS CLI).

Then deploy the app from the repo root (a clean checkout on Linux x86_64, because the SQLite
driver is a native module built for the machine that runs `npm ci`):

```bash
export AWS_REGION=<your-region>
export GS_BUCKET=$(cd deploy/pulumi && pulumi stack output bucketName)
export GS_INSTANCE_ID=$(cd deploy/pulumi && pulumi stack output instanceId)
deploy/release.sh
```

`release.sh` builds, uploads `releases/<commit>.tgz`, and runs `remote-deploy.sh` on the instance
through SSM: it unpacks the release, switches the `current` symlink, restarts the service, checks
`/api/health`, and rolls back to the previous release if the check fails.

## Day to day

- **Create accounts without the invite code:** open a Session Manager shell and run
  `cd /opt/graphspace/current && sudo -u graphspace DATABASE_PATH=/var/lib/graphspace/gs.db npx tsx scripts/create-user.ts student@example.com "Name"`.
  (Or share the invite code; change it with `pulumi config set --secret inviteCode … && pulumi up`, then redeploy.)
- **Logs:** `journalctl -u graphspace -f` and `journalctl -u caddy -f`.
- **Backups:** `graphspace-backup.timer` runs nightly at 03:17 UTC and copies a consistent snapshot
  of the database to `s3://<bucket>/backups/YYYY/MM/DD/`, kept for 30 days. Run one now with
  `sudo systemctl start graphspace-backup`.
- **Restore a backup:** stop the service, `aws s3 cp` the backup down, `gunzip` it over
  `/var/lib/graphspace/gs.db` (owned by `graphspace`), start the service.

## Tearing down

`pulumi destroy` removes the instance, Elastic IP, role, security group and parameter. The bucket is
kept unless it's empty (it holds your backups); delete it yourself when you're sure.
