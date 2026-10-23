/**
 * Version control on full snapshots: a commit points at a stored copy of the whole document and
 * at its parent commit; a branch is a named head plus its own working copy. No merges.
 */
import { createHash, randomBytes } from 'node:crypto';
import { newId } from '@/doc/ids';
import { makeThumb, type Thumb } from '@/doc/thumb';
import type { ProjectDoc } from '@/doc/types';
import { Db, now, packJson, unpackJson } from '../db';
import { HttpError, notFound } from '../http';
import { getWorking } from './projects';

export interface CommitInfo {
  id: string;
  branchId: string;
  parentId: string | null;
  message: string;
  createdAt: number;
  thumb: Thumb;
}

function owned(db: Db, userId: string, projectId: string) {
  const row = db.prepare('SELECT owner_id, default_branch_id FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId) as
    | { owner_id: string; default_branch_id: string }
    | undefined;
  if (!row || row.owner_id !== userId) throw notFound();
  return row;
}

function branchRow(db: Db, projectId: string, branchId: string) {
  const b = db.prepare('SELECT id, name, head_commit_id, version FROM branches WHERE id = ? AND project_id = ?').get(branchId, projectId) as
    | { id: string; name: string; head_commit_id: string | null; version: number }
    | undefined;
  if (!b) throw notFound();
  return b;
}

/** Store a document once, keyed by the hash of its JSON. */
export function storeSnapshot(db: Db, doc: ProjectDoc): string {
  const json = JSON.stringify(doc);
  const hash = createHash('sha256').update(json).digest('hex');
  db.prepare('INSERT OR IGNORE INTO snapshots (hash, doc, size, created_at) VALUES (?, ?, ?, ?)').run(hash, packJson(doc), json.length, now());
  return hash;
}

function snapshotDoc(db: Db, hash: string): ProjectDoc {
  const row = db.prepare('SELECT doc FROM snapshots WHERE hash = ?').get(hash) as { doc: Buffer } | undefined;
  if (!row) throw notFound();
  return unpackJson<ProjectDoc>(row.doc);
}

export function listCommits(db: Db, userId: string, projectId: string): CommitInfo[] {
  owned(db, userId, projectId);
  const rows = db
    .prepare('SELECT id, branch_id, parent_id, message, created_at, thumb FROM commits WHERE project_id = ? ORDER BY created_at, rowid')
    .all(projectId) as { id: string; branch_id: string; parent_id: string | null; message: string; created_at: number; thumb: string }[];
  return rows.map((r) => ({ id: r.id, branchId: r.branch_id, parentId: r.parent_id, message: r.message, createdAt: r.created_at, thumb: JSON.parse(r.thumb) }));
}

export function getCommitDoc(db: Db, userId: string, projectId: string, commitId: string): ProjectDoc {
  owned(db, userId, projectId);
  const row = db.prepare('SELECT snapshot_hash FROM commits WHERE id = ? AND project_id = ?').get(commitId, projectId) as { snapshot_hash: string } | undefined;
  if (!row) throw notFound();
  return snapshotDoc(db, row.snapshot_hash);
}

/**
 * Commit a branch's saved working copy. `expectVersion` makes sure the client's latest edits were
 * saved first (otherwise 409).
 */
export function createCommit(db: Db, userId: string, projectId: string, branchId: string, message: string, expectVersion: number): CommitInfo {
  owned(db, userId, projectId);
  return db.transaction((): CommitInfo => {
    const b = branchRow(db, projectId, branchId);
    if (b.version !== expectVersion) throw new HttpError(409, 'Your latest changes are still saving. Try again in a moment.', { version: b.version });
    const { doc } = getWorking(db, userId, projectId, branchId);
    const hash = storeSnapshot(db, doc);
    const id = randomBytes(6).toString('hex');
    const thumb = makeThumb(doc);
    const t = now();
    db.prepare(
      'INSERT INTO commits (id, project_id, branch_id, parent_id, snapshot_hash, thumb, message, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, projectId, branchId, b.head_commit_id, hash, JSON.stringify(thumb), message, userId, t);
    db.prepare('UPDATE branches SET head_commit_id = ? WHERE id = ?').run(id, branchId);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(t, projectId);
    return { id, branchId, parentId: b.head_commit_id, message, createdAt: t, thumb };
  })();
}

/** A new branch starting from a commit (its working copy is that commit's document). */
export function createBranch(db: Db, userId: string, projectId: string, name: string, fromCommitId: string) {
  owned(db, userId, projectId);
  const doc = getCommitDoc(db, userId, projectId, fromCommitId);
  if (db.prepare('SELECT 1 FROM branches WHERE project_id = ? AND name = ?').get(projectId, name)) {
    throw new HttpError(409, `There is already a branch called “${name}”.`);
  }
  const id = newId();
  const t = now();
  db.prepare('INSERT INTO branches (id, project_id, name, head_commit_id, working_doc, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)').run(
    id,
    projectId,
    name,
    fromCommitId,
    packJson(doc),
    t,
    t,
  );
  return { id, name };
}

export function renameBranch(db: Db, userId: string, projectId: string, branchId: string, name: string) {
  owned(db, userId, projectId);
  branchRow(db, projectId, branchId);
  if (db.prepare('SELECT 1 FROM branches WHERE project_id = ? AND name = ? AND id != ?').get(projectId, name, branchId)) {
    throw new HttpError(409, `There is already a branch called “${name}”.`);
  }
  db.prepare('UPDATE branches SET name = ? WHERE id = ?').run(name, branchId);
}

/** Delete a branch (its commits stay in history). The last branch can't be deleted. */
export function deleteBranch(db: Db, userId: string, projectId: string, branchId: string) {
  const p = owned(db, userId, projectId);
  branchRow(db, projectId, branchId);
  const others = db.prepare('SELECT id FROM branches WHERE project_id = ? AND id != ? ORDER BY created_at').all(projectId, branchId) as { id: string }[];
  if (!others.length) throw new HttpError(400, "A project needs at least one branch.");
  db.transaction(() => {
    if (p.default_branch_id === branchId) db.prepare('UPDATE projects SET default_branch_id = ? WHERE id = ?').run(others[0].id, projectId);
    db.prepare('DELETE FROM branches WHERE id = ?').run(branchId);
  })();
}

/** Remember which branch to open the project on. */
export function setDefaultBranch(db: Db, userId: string, projectId: string, branchId: string) {
  owned(db, userId, projectId);
  branchRow(db, projectId, branchId);
  db.prepare('UPDATE projects SET default_branch_id = ? WHERE id = ?').run(branchId, projectId);
}
