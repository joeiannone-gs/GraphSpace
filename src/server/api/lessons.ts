import { z } from 'zod';
import { json, readJson, requireUser, route } from '../http';
import { listProgress, saveProgress, startLesson } from '../repo/lessons';

const lessonId = (v: string | undefined) => z.string().regex(/^[a-z0-9-]{1,60}$/).parse(v);

export const progress = route((ctx) => json({ progress: listProgress(ctx.db, requireUser(ctx).id) }), { auth: true });

export const start = route((ctx) => json(startLesson(ctx.db, requireUser(ctx).id, lessonId(ctx.params.id))), { auth: true });

export const update = route(
  async (ctx) => {
    const body = await readJson(ctx.req, z.object({ step: z.number().int().min(0), completed: z.boolean() }));
    saveProgress(ctx.db, requireUser(ctx).id, lessonId(ctx.params.id), body.step, body.completed);
    return json({ ok: true });
  },
  { auth: true },
);
