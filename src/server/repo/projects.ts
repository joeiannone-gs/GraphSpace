/** Projects and their branches' working copies. Every function checks ownership; others get 404. */
import { newId } from '@/doc/ids';
import { makeThumb, type Thumb } from '@/doc/thumb';
import type { ProjectDoc } from '@/doc/types';
import { Db, now, packJson, unpackJson } from '../db';
import { notFound } from '../http';

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: number;
  lessonId: string | null;
  thumb: Thumb | null;
}

export interface BranchInfo {
  id: string;
  name: string;
  headCommitId: string | null;
  version: number;
  updatedAt: number;
}

export interface ProjectInfo extends ProjectSummary {
  defaultBranchId: string;
  forkedFrom: string | null;
  branches: BranchInfo[];
}

interface ProjectRow {
  id: string;
  owner_id: string;
  title: string;
  default_branch_id: string;
  forked_from: string | null;
  lesson_id: string | null;
  thumb: string | null;
  updated_at: number;
}

export function listProjects(db: Db, userId: string): ProjectSummary[] {
  const rows = db
    .prepare('SELECT id, title, updated_at, lesson_id, thumb FROM projects WHERE owner_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC')
    .all(userId) as ProjectRow[];
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at, lessonId: r.lesson_id, thumb: r.thumb ? JSON.parse(r.thumb) : null }));
}

function ownedRow(db: Db, userId: string, projectId: string): ProjectRow {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL').get(projectId) as ProjectRow | undefined;
  if (!row || row.owner_id !== userId) throw notFound();
  return row;
}

export function createProject(
  db: Db,
  userId: string,
  opts: { title: string; doc: ProjectDoc; forkedFrom?: string; lessonId?: string },
): { id: string; branchId: string } {
  const id = newId();
  const branchId = newId();
  const t = now();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, owner_id, title, default_branch_id, forked_from, lesson_id, thumb, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, opts.title, branchId, opts.forkedFrom ?? null, opts.lessonId ?? null, JSON.stringify(makeThumb(opts.doc)), t, t);
    db.prepare('INSERT INTO branches (id, project_id, name, working_doc, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').run(
      branchId,
      id,
      'main',
      packJson(opts.doc),
      t,
      t,
    );
  })();
  return { id, branchId };
}

export function getProject(db: Db, userId: string, projectId: string): ProjectInfo {
  const row = ownedRow(db, userId, projectId);
  const branches = db
    .prepare('SELECT id, name, head_commit_id AS headCommitId, version, updated_at AS updatedAt FROM branches WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as BranchInfo[];
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    lessonId: row.lesson_id,
    thumb: row.thumb ? JSON.parse(row.thumb) : null,
    defaultBranchId: row.default_branch_id,
    forkedFrom: row.forked_from,
    branches,
  };
}

export function renameProject(db: Db, userId: string, projectId: string, title: string) {
  ownedRow(db, userId, projectId);
  db.prepare('UPDATE projects SET title = ?, updated_at = ? WHERE id = ?').run(title, now(), projectId);
}

export function deleteProject(db: Db, userId: string, projectId: string) {
  ownedRow(db, userId, projectId);
  db.prepare('UPDATE projects SET deleted_at = ? WHERE id = ?').run(now(), projectId);
}

interface BranchRow {
  id: string;
  project_id: string;
  working_doc: Buffer;
  version: number;
}

export function getWorking(db: Db, userId: string, projectId: string, branchId: string): { doc: ProjectDoc; version: number } {
  ownedRow(db, userId, projectId);
  const b = db.prepare('SELECT id, project_id, working_doc, version FROM branches WHERE id = ? AND project_id = ?').get(branchId, projectId) as
    | BranchRow
    | undefined;
  if (!b) throw notFound();
  return { doc: unpackJson<ProjectDoc>(b.working_doc), version: b.version };
}

export type SaveResult = { ok: true; version: number } | { ok: false; version: number; doc: ProjectDoc };

/**
 * Save a branch's working copy if nobody saved since `baseVersion` (compare-and-set), or
 * unconditionally with `force`. On conflict, returns what's stored so the client can choose.
 */
export function saveWorking(
  db: Db,
  userId: string,
  projectId: string,
  branchId: string,
  doc: ProjectDoc,
  baseVersion: number,
  force = false,
): SaveResult {
  const project = ownedRow(db, userId, projectId);
  const t = now();
  return db.transaction((): SaveResult => {
    const r = db
      .prepare('UPDATE branches SET working_doc = ?, version = version + 1, updated_at = ? WHERE id = ? AND project_id = ? AND (version = ? OR ?)')
      .run(packJson(doc), t, branchId, projectId, baseVersion, force ? 1 : 0);
    if (r.changes === 0) {
      const current = getWorking(db, userId, projectId, branchId);
      return { ok: false, ...current };
    }
    const version = (db.prepare('SELECT version FROM branches WHERE id = ?').get(branchId) as { version: number }).version;
    const thumb = branchId === project.default_branch_id ? JSON.stringify(makeThumb(doc)) : project.thumb;
    db.prepare('UPDATE projects SET updated_at = ?, thumb = ? WHERE id = ?').run(t, thumb, projectId);
    return { ok: true, version };
  })();
}
