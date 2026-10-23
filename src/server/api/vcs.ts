import { z } from 'zod';
import { idParam, json, readJson, requireUser, route } from '../http';
import { getProject } from '../repo/projects';
import { createBranch, createCommit, deleteBranch, getCommitDoc, listCommits, renameBranch } from '../repo/vcs';

const branchName = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\w .-]+$/, 'Use letters, numbers, spaces, dots, dashes or underscores');

export const history = route(
  (ctx) => {
    const user = requireUser(ctx);
    const pid = idParam(ctx.params.pid);
    return json({ commits: listCommits(ctx.db, user.id, pid), branches: getProject(ctx.db, user.id, pid).branches });
  },
  { auth: true },
);

export const commitDoc = route(
  (ctx) => json({ doc: getCommitDoc(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid), idParam(ctx.params.cid)) }),
  { auth: true },
);

export const commit = route(
  async (ctx) => {
    const body = await readJson(ctx.req, z.object({ message: z.string().trim().min(1).max(500), expectVersion: z.number().int() }));
    const c = createCommit(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid), idParam(ctx.params.bid), body.message, body.expectVersion);
    return json({ commit: c }, { status: 201 });
  },
  { auth: true },
);

export const newBranch = route(
  async (ctx) => {
    const body = await readJson(ctx.req, z.object({ name: branchName, fromCommitId: z.string().regex(/^[0-9a-f]{12}$/) }));
    return json({ branch: createBranch(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid), body.name, body.fromCommitId) }, { status: 201 });
  },
  { auth: true },
);

export const updateBranch = route(
  async (ctx) => {
    const body = await readJson(ctx.req, z.object({ name: branchName }));
    renameBranch(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid), idParam(ctx.params.bid), body.name);
    return json({ ok: true });
  },
  { auth: true },
);

export const removeBranch = route(
  (ctx) => {
    deleteBranch(ctx.db, requireUser(ctx).id, idParam(ctx.params.pid), idParam(ctx.params.bid));
    return json({ ok: true });
  },
  { auth: true },
);
