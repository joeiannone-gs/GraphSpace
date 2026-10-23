/**
 * GraphSpace on one EC2 instance in the project's selected Region:
 * - Ubuntu 24.04, t3.small with standard CPU credits (no surprise "unlimited" charges),
 *   IMDSv2 required, encrypted gp3 root volume, Elastic IP.
 * - No SSH: only ports 80/443 are open; administration goes through SSM Session Manager.
 * - A private S3 bucket holds release tarballs and nightly database backups (expired after 30 days).
 * - The sign-up invite code lives in SSM Parameter Store as a SecureString.
 */
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';
import * as path from 'path';

const cfg = new pulumi.Config();
const domain = cfg.require('domain');
const inviteCode = cfg.requireSecret('inviteCode');
const instanceType = cfg.get('instanceType') ?? 't3.small';
const name = 'graphspace';

// ---- storage ----

const bucket = new aws.s3.Bucket(name, { forceDestroy: false });
new aws.s3.BucketPublicAccessBlock(name, {
  bucket: bucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});
new aws.s3.BucketServerSideEncryptionConfiguration(name, {
  bucket: bucket.id,
  rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: 'AES256' } }],
});
new aws.s3.BucketVersioning(name, { bucket: bucket.id, versioningConfiguration: { status: 'Enabled' } });
new aws.s3.BucketLifecycleConfiguration(name, {
  bucket: bucket.id,
  rules: [
    { id: 'backups', status: 'Enabled', filter: { prefix: 'backups/' }, expiration: { days: 30 }, noncurrentVersionExpiration: { noncurrentDays: 7 } },
    { id: 'releases', status: 'Enabled', filter: { prefix: 'releases/' }, expiration: { days: 90 }, noncurrentVersionExpiration: { noncurrentDays: 7 } },
  ],
});

const invite = new aws.ssm.Parameter(`${name}-invite-code`, { name: '/graphspace/invite-code', type: 'SecureString', value: inviteCode });

// ---- identity: SSM management, read releases, write backups, read the invite code ----

const role = new aws.iam.Role(name, {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Principal: { Service: 'ec2.amazonaws.com' }, Action: 'sts:AssumeRole' }],
  }),
});
new aws.iam.RolePolicyAttachment(`${name}-ssm`, { role: role.name, policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' });
new aws.iam.RolePolicy(name, {
  role: role.id,
  policy: pulumi.jsonStringify({
    Version: '2012-10-17',
    Statement: [
      { Effect: 'Allow', Action: ['s3:GetObject'], Resource: pulumi.interpolate`${bucket.arn}/releases/*` },
      { Effect: 'Allow', Action: ['s3:PutObject'], Resource: pulumi.interpolate`${bucket.arn}/backups/*` },
      { Effect: 'Allow', Action: ['ssm:GetParameter'], Resource: invite.arn },
    ],
  }),
});
const profile = new aws.iam.InstanceProfile(name, { role: role.name });

// ---- network: default VPC, web ports only ----

const vpc = aws.ec2.getVpcOutput({ default: true });
const sg = new aws.ec2.SecurityGroup(`${name}-web`, {
  vpcId: vpc.id,
  description: 'GraphSpace: HTTP/HTTPS in (Caddy), everything out',
  ingress: [80, 443].map((port) => ({ protocol: 'tcp', fromPort: port, toPort: port, cidrBlocks: ['0.0.0.0/0'], ipv6CidrBlocks: ['::/0'] })),
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'], ipv6CidrBlocks: ['::/0'] }],
});

// ---- instance ----

const file = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const b64 = (s: string) => Buffer.from(s).toString('base64');
const put = (dest: string, content: string, mode: string) => `echo '${b64(content)}' | base64 -d > ${dest} && chmod ${mode} ${dest}`;

const userData = bucket.id.apply((bucketName) =>
  [
    '#!/bin/bash',
    'set -euxo pipefail',
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update && apt-get -y upgrade',
    'apt-get install -y curl gnupg sqlite3 debian-keyring debian-archive-keyring apt-transport-https',
    'curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs',
    "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg",
    "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list",
    'apt-get update && apt-get install -y caddy',
    'snap install aws-cli --classic',
    'useradd --system --home /var/lib/graphspace --shell /usr/sbin/nologin graphspace || true',
    'mkdir -p /opt/graphspace/releases /opt/graphspace/bin /var/lib/graphspace /etc/graphspace',
    'chown graphspace:graphspace /var/lib/graphspace && chmod 750 /var/lib/graphspace',
    `echo '${bucketName}' > /etc/graphspace/bucket`,
    put('/etc/systemd/system/graphspace.service', file('graphspace.service'), '644'),
    put('/etc/systemd/system/graphspace-backup.service', file('graphspace-backup.service'), '644'),
    put('/etc/systemd/system/graphspace-backup.timer', file('graphspace-backup.timer'), '644'),
    put('/opt/graphspace/bin/remote-deploy.sh', file('remote-deploy.sh'), '755'),
    put('/opt/graphspace/bin/backup.sh', file('backup.sh'), '755'),
    put('/etc/caddy/Caddyfile', file('Caddyfile').replace('__DOMAIN__', domain), '644'),
    'systemctl daemon-reload',
    'systemctl enable graphspace graphspace-backup.timer',
    'systemctl start graphspace-backup.timer',
    'systemctl restart caddy',
    'echo "provisioned; deploy a release with deploy/release.sh"',
  ].join('\n'),
);

const ami = aws.ssm.getParameterOutput({ name: '/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id' }).value;

const instance = new aws.ec2.Instance(
  name,
  {
    ami,
    instanceType,
    iamInstanceProfile: profile.name,
    vpcSecurityGroupIds: [sg.id],
    creditSpecification: { cpuCredits: 'standard' },
    metadataOptions: { httpEndpoint: 'enabled', httpTokens: 'required', httpPutResponseHopLimit: 1 },
    rootBlockDevice: { volumeType: 'gp3', volumeSize: 20, encrypted: true },
    userData,
    tags: { Name: name },
  },
  // Newer Ubuntu images shouldn't replace a running server; patch in place instead.
  { ignoreChanges: ['ami', 'userData'] },
);

const eip = new aws.ec2.Eip(name, { domain: 'vpc', instance: instance.id, tags: { Name: name } });

export const publicIp = eip.publicIp;
export const instanceId = instance.id;
export const bucketName = bucket.id;
export const url = `https://${domain}`;
export const dnsRecord = pulumi.interpolate`${domain}  A  ${eip.publicIp}`;
