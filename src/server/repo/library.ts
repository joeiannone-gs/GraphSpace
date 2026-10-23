/** A user's saved groups ("Nodes" in My GraphSpace). */
import type { Subtree } from '@/doc/clone';
import { newId } from '@/doc/ids';
import { Db, now, packJson, unpackJson } from '../db';
import { notFound } from '../http';

export interface LibraryNode {
  id: string;
  name: string;
  description: string;
  version: number;
  updatedAt: number;
  subtree: Subtree;
}

export function listLibrary(db: Db, userId: string): LibraryNode[] {
  const rows = db
    .prepare('SELECT id, name, description, version, updated_at, subtree FROM library_nodes WHERE owner_id = ? ORDER BY name COLLATE NOCASE')
    .all(userId) as { id: string; name: string; description: string; version: number; updated_at: number; subtree: Buffer }[];
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, version: r.version, updatedAt: r.updated_at, subtree: unpackJson<Subtree>(r.subtree) }));
}

export function saveLibraryNode(db: Db, userId: string, input: { name: string; description: string; subtree: Subtree }): string {
  const id = newId();
  const t = now();
  db.prepare('INSERT INTO library_nodes (id, owner_id, name, description, subtree, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)').run(
    id,
    userId,
    input.name,
    input.description,
    packJson(input.subtree),
    t,
    t,
  );
  return id;
}

export function deleteLibraryNode(db: Db, userId: string, id: string) {
  const r = db.prepare('DELETE FROM library_nodes WHERE id = ? AND owner_id = ?').run(id, userId);
  if (r.changes === 0) throw notFound();
}
