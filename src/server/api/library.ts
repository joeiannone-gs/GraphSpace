import { z } from 'zod';
import { subtreeSchema } from '@/doc/schema';
import type { Subtree } from '@/doc/clone';
import { idParam, json, readJson, requireUser, route } from '../http';
import { deleteLibraryNode, listLibrary, saveLibraryNode } from '../repo/library';

export const list = route((ctx) => json({ nodes: listLibrary(ctx.db, requireUser(ctx).id) }), { auth: true });

export const create = route(
  async (ctx) => {
    const body = await readJson(
      ctx.req,
      z.object({ name: z.string().trim().min(1).max(60), description: z.string().max(2000).default(''), subtree: subtreeSchema }),
    );
    const id = saveLibraryNode(ctx.db, requireUser(ctx).id, { ...body, subtree: body.subtree as Subtree });
    return json({ id }, { status: 201 });
  },
  { auth: true },
);

export const remove = route(
  (ctx) => {
    deleteLibraryNode(ctx.db, requireUser(ctx).id, idParam(ctx.params.id));
    return json({ ok: true });
  },
  { auth: true },
);
