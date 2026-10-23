import { z } from 'zod';
import { idParam, json, readJson, requireUser, route } from '../http';
import { createShare, forkShare, listShares, readShare, revokeShare } from '../repo/shares';

const token = (v: string | undefined) => z.string().regex(/^[A-Za-z0-9_-]{16,64}$/).parse(v);

export const create = route(
  async (ctx) => {
    const body = await readJson(ctx.req, z.object({ branchId: z.string().max(64) }));
    return json({ share: createShare(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid), idParam(body.branchId)) }, { status: 201 });
  },
  { auth: true },
);

export const list = route((ctx) => json({ shares: listShares(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid)) }), { auth: true });

export const get = route((ctx) => json(readShare(ctx.db, token(ctx.params.token))));

export const revoke = route(
  (ctx) => {
    revokeShare(ctx.db, requireUser(ctx).id, token(ctx.params.token));
    return json({ ok: true });
  },
  { auth: true },
);

export const fork = route((ctx) => json(forkShare(ctx.db, requireUser(ctx).id, token(ctx.params.token)), { status: 201 }), { auth: true });
