/** Passwords (scrypt), sessions (random token in an httpOnly cookie, only its hash stored). */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { newId } from '@/doc/ids';
import { Db, now } from './db';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const MAXMEM = 64 * 1024 * 1024;

export const SESSION_COOKIE = 'gs_session';
export const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Constant-time string comparison (compares fixed-length digests). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(sha256(a), 'hex'), Buffer.from(sha256(b), 'hex'));
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export function createSession(db: Db, userId: string): { token: string; expires: Date } {
  const token = randomBytes(32).toString('base64url');
  const created = now();
  const expires = created + SESSION_DAYS * 24 * 3600 * 1000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), userId, created, expires);
  return { token, expires: new Date(expires) };
}

export function userForSession(db: Db, token: string | undefined): User | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.display_name AS displayName, s.expires_at AS expiresAt
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as (User & { expiresAt: number }) | undefined;
  if (!row || row.expiresAt < now()) return null;
  return { id: row.id, email: row.email, displayName: row.displayName };
}

export function deleteSession(db: Db, token: string | undefined) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export async function createUser(db: Db, email: string, password: string, displayName: string): Promise<User> {
  const id = newId();
  const hash = await hashPassword(password);
  db.prepare('INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    email.trim().toLowerCase(),
    displayName.trim(),
    hash,
    now(),
  );
  return { id, email: email.trim().toLowerCase(), displayName: displayName.trim() };
}

export async function checkLogin(db: Db, email: string, password: string): Promise<User | null> {
  const row = db
    .prepare('SELECT id, email, display_name AS displayName, password_hash AS hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as (User & { hash: string }) | undefined;
  if (!row) {
    // Spend the same time as a real check so response timing doesn't reveal which emails exist.
    await hashPassword(password);
    return null;
  }
  return (await verifyPassword(password, row.hash)) ? { id: row.id, email: row.email, displayName: row.displayName } : null;
}

/** Simple in-memory limiter for login attempts (one server process). */
const attempts = new Map<string, { count: number; until: number }>();
export function loginAllowed(key: string): boolean {
  const a = attempts.get(key);
  return !a || a.until < now() || a.count < 8;
}
export function noteLoginFailure(key: string) {
  const a = attempts.get(key);
  const t = now();
  if (!a || a.until < t) attempts.set(key, { count: 1, until: t + 15 * 60 * 1000 });
  else a.count++;
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
