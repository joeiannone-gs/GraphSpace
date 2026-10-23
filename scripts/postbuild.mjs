// Next's standalone output does not include static assets; copy them next to server.js.
import fs from 'node:fs';

const target = '.next/standalone';
if (fs.existsSync(target)) {
  fs.cpSync('public', `${target}/public`, { recursive: true });
  fs.cpSync('.next/static', `${target}/.next/static`, { recursive: true });
}
