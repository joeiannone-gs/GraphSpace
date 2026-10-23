/** Read-only share links: a frozen snapshot anyone with the link can open, run and fork. */
import { randomBytes } from 'node:crypto';
import type { ProjectDoc } from '@/doc/types';
import { Db, now, unpackJson } from '../db';
import { notFound } from '../http';
import { createProject, getProject, getWorking } from './projects';
import { storeSnapshot } from './vcs';

export interface ShareInfo {
  token: string;
  title: string;
  createdAt: number;
}

export function createShare(db: Db, userId: string, projectId: string, branchId: string): ShareInfo {
  const project = getProject(db, userId, projectId);
  const { doc } = getWorking(db, userId, projectId, branchId);
  const hash = storeSnapshot(db, doc);
  const token = randomBytes(16).toString('base64url');
  const t = now();
  db.prepare('INSERT INTO share_links (token, project_id, snapshot_hash, title, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    token,
    projectId,
    hash,
    project.title,
    userId,
    t,
  );
  return { token, title: project.title, createdAt: t };
}

export function listShares(db: Db, userId: string, projectId: string): ShareInfo[] {
  getProject(db, userId, projectId);
  return (
    db.prepare('SELECT token, title, created_at FROM share_links WHERE project_id = ? AND revoked_at IS NULL ORDER BY created_at DESC').all(projectId) as {
      token: string;
      title: string;
      created_at: number;
    }[]
  ).map((r) => ({ token: r.token, title: r.title, createdAt: r.created_at }));
}

export function revokeShare(db: Db, userId: string, token: string) {
  const r = db.prepare('UPDATE share_links SET revoked_at = ? WHERE token = ? AND created_by = ? AND revoked_at IS NULL').run(now(), token, userId);
  if (r.changes === 0) throw notFound();
}

/** Public: what a share link shows. */
export function readShare(db: Db, token: string): { title: string; author: string; doc: ProjectDoc } {
  const row = db
    .prepare(
      `SELECT s.title, s.snapshot_hash, u.display_name AS author FROM share_links s
       JOIN users u ON u.id = s.created_by JOIN projects p ON p.id = s.project_id
       WHERE s.token = ? AND s.revoked_at IS NULL AND p.deleted_at IS NULL`,
    )
    .get(token) as { title: string; snapshot_hash: string; author: string } | undefined;
  if (!row) throw notFound();
  const snap = db.prepare('SELECT doc FROM snapshots WHERE hash = ?').get(row.snapshot_hash) as { doc: Buffer };
  return { title: row.title, author: row.author, doc: unpackJson<ProjectDoc>(snap.doc) };
}

export function forkShare(db: Db, userId: string, token: string) {
  const share = readShare(db, token);
  return createProject(db, userId, { title: `${share.title} (copy)`, doc: share.doc, forkedFrom: `share:${token}` });
}
