/** Which lesson step each learner has reached, and the project they're doing it in. */
import { getLesson } from '@/lessons';
import { Db, now } from '../db';
import { HttpError, notFound } from '../http';
import { createProject } from './projects';

export interface Progress {
  lessonId: string;
  projectId: string;
  step: number;
  completed: boolean;
}

export function listProgress(db: Db, userId: string): Progress[] {
  const rows = db
    .prepare(
      `SELECT lp.lesson_id, lp.project_id, lp.step, lp.completed_at FROM lesson_progress lp
       JOIN projects p ON p.id = lp.project_id WHERE lp.user_id = ? AND p.deleted_at IS NULL`,
    )
    .all(userId) as { lesson_id: string; project_id: string; step: number; completed_at: number | null }[];
  return rows.map((r) => ({ lessonId: r.lesson_id, projectId: r.project_id, step: r.step, completed: r.completed_at !== null }));
}

export function getProgress(db: Db, userId: string, lessonId: string): Progress | undefined {
  return listProgress(db, userId).find((p) => p.lessonId === lessonId);
}

/** The learner's project for a lesson, created from the starter the first time. */
export function startLesson(db: Db, userId: string, lessonId: string): Progress {
  const lesson = getLesson(lessonId);
  if (!lesson) throw notFound();
  const existing = getProgress(db, userId, lessonId);
  if (existing) return existing;
  const { id } = createProject(db, userId, { title: `Lesson: ${lesson.title}`, doc: lesson.starter(), lessonId });
  db.prepare(
    `INSERT INTO lesson_progress (user_id, lesson_id, project_id, step, updated_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET project_id = excluded.project_id, step = 0, completed_at = NULL, updated_at = excluded.updated_at`,
  ).run(userId, lessonId, id, now());
  return { lessonId, projectId: id, step: 0, completed: false };
}

export function saveProgress(db: Db, userId: string, lessonId: string, step: number, completed: boolean) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw notFound();
  if (step < 0 || step >= lesson.steps.length) throw new HttpError(400, 'No such step');
  const r = db
    .prepare('UPDATE lesson_progress SET step = ?, completed_at = CASE WHEN ? THEN COALESCE(completed_at, ?) ELSE completed_at END, updated_at = ? WHERE user_id = ? AND lesson_id = ?')
    .run(step, completed ? 1 : 0, now(), now(), userId, lessonId);
  if (r.changes === 0) throw notFound();
}
