// Next's standalone output does not include static assets; copy them next to server.js.
// Also bundle the admin CLI (create-user) into the release.
import { build } from 'esbuild';
import fs from 'node:fs';

const target = '.next/standalone';
if (fs.existsSync(target)) {
  fs.cpSync('public', `${target}/public`, { recursive: true });
  fs.cpSync('.next/static', `${target}/.next/static`, { recursive: true });
  await build({
    entryPoints: ['scripts/create-user.ts'],
    outfile: `${target}/cli/create-user.mjs`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    external: ['better-sqlite3'],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    logLevel: 'warning',
  });
}
