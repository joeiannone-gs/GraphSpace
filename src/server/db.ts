/**
 * SQLite access (better-sqlite3: synchronous, which is simplest for a handful of users).
 * Schema changes are numbered migrations applied at startup, tracked in PRAGMA user_version.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { env } from '@/lib/env';
import { migrations } from './migrations';

export type Db = Database.Database;

let instance: { path: string; db: Db } | null = null;

export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

export function migrate(db: Db) {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < migrations.length; v++) {
    db.transaction(() => {
      db.exec(migrations[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

/** The process-wide database (path from DATABASE_PATH). */
export function getDb(): Db {
  const file = process.env.DATABASE_PATH || env.databasePath;
  if (!instance || instance.path !== file) {
    instance?.db.close();
    instance = { path: file, db: openDb(file) };
  }
  return instance.db;
}

export const now = () => Date.now();

export const packJson = (value: unknown): Buffer => gzipSync(Buffer.from(JSON.stringify(value)));
export const unpackJson = <T>(blob: Buffer): T => JSON.parse(gunzipSync(blob).toString('utf8')) as T;
