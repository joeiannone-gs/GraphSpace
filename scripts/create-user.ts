/**
 * Create an account without an invite code.
 *   Development:  npx tsx scripts/create-user.ts student@example.com "Student Name"
 *   On a server:  DATABASE_PATH=/var/lib/graphspace/gs.db node cli/create-user.mjs student@example.com "Student Name"
 *                 (the release bundles this script as cli/create-user.mjs)
 * The password is read from GS_PASSWORD or prompted for.
 */
import { createInterface } from 'node:readline/promises';
import { createUser } from '@/server/auth';
import { openDb } from '@/server/db';
import { env } from '@/lib/env';

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  if (!email || !email.includes('@')) {
    console.error('Usage: create-user.ts <email> [display name]');
    process.exit(1);
  }
  let password = process.env.GS_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question('Password (8+ characters): ');
    rl.close();
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  const db = openDb(process.env.DATABASE_PATH || env.databasePath);
  const user = await createUser(db, email, password, nameParts.join(' ') || email.split('@')[0]);
  console.log(`Created ${user.email} (${user.id})`);
  db.close();
}

void main();
