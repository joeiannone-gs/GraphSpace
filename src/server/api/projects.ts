import { z } from 'zod';
import { projectDocSchema } from '@/doc/schema';
import { migrate } from '@/doc/migrate';
import { emptyDoc, type ProjectDoc } from '@/doc/types';
import { getExample } from '@/gallery/examples';
import { HttpError, idParam, json, readJson, requireUser, route } from '../http';
import { createProject, deleteProject, getProject, getWorking, listProjects, renameProject, saveWorking } from '../repo/projects';

const title = z.string().trim().min(1).max(120);

export const list = route((ctx) => json({ projects: listProjects(ctx.db, requireUser(ctx).id) }), { auth: true });

export const create = route(
  async (ctx) => {
    const user = requireUser(ctx);
    const body = await readJson(
      ctx.req,
      z.object({
        title: title.optional(),
        from: z
          .discriminatedUnion('kind', [
            z.object({ kind: z.literal('blank') }),
            z.object({ kind: z.literal('example'), slug: z.string().max(80) }),
            z.object({ kind: z.literal('doc'), doc: z.unknown() }),
          ])
          .default({ kind: 'blank' }),
      }),
    );
    let doc: ProjectDoc;
    let forkedFrom: string | undefined;
    let defaultTitle = 'Untitled project';
    if (body.from.kind === 'example') {
      const ex = getExample(body.from.slug);
      if (!ex) throw new HttpError(404, 'No such example');
      doc = ex.build();
      forkedFrom = `gallery:${ex.slug}`;
      defaultTitle = ex.title;
    } else if (body.from.kind === 'doc') {
      doc = migrate(body.from.doc);
    } else {
      doc = emptyDoc();
    }
    const created = createProject(ctx.db, user.id, { title: body.title ?? defaultTitle, doc, forkedFrom });
    return json(created, { status: 201 });
  },
  { auth: true },
);

export const get = route((ctx) => json({ project: getProject(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid)) }), { auth: true });

export const update = route(
  async (ctx) => {
    const body = await readJson(ctx.req, z.object({ title }));
    renameProject(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid), body.title);
    return json({ ok: true });
  },
  { auth: true },
);

export const remove = route(
  (ctx) => {
    deleteProject(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid));
    return json({ ok: true });
  },
  { auth: true },
);

export const getWorkingDoc = route(
  (ctx) => json(getWorking(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid), idParam(ctx.params.bid))),
  { auth: true },
);

export const putWorkingDoc = route(
  async (ctx) => {
    const body = await readJson(ctx.req, z.object({ doc: projectDocSchema, baseVersion: z.number().int(), force: z.boolean().optional() }));
    const result = saveWorking(
      ctx.db,
      requireUser(ctx).id,
      idParam(ctx.params.pid),
      idParam(ctx.params.bid),
      body.doc as ProjectDoc,
      body.baseVersion,
      body.force,
    );
    if (!result.ok) throw new HttpError(409, 'Someone else saved this project since you opened it.', { version: result.version, doc: result.doc });
    return json({ version: result.version });
  },
  { auth: true },
);
