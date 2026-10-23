import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fitALine } from '@/gallery/examples';
import { DocBuilder } from '@/doc/builder';
import { extractSubtree } from '@/doc/clone';
import * as auth from './api/auth';
import * as library from './api/library';
import * as projects from './api/projects';
import * as vcs from './api/vcs';
import * as shares from './api/shares';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-api-'));
const ORIGIN = 'http://gs.test';

beforeAll(() => {
  process.env.DATABASE_PATH = path.join(dir, 'test.db');
  process.env.INVITE_CODE = 'let-me-in';
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

type Handler = (req: Request, ctx?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

function call(handler: Handler, method: string, opts: { body?: unknown; cookie?: string; params?: Record<string, string>; origin?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin !== null && method !== 'GET') headers.origin = opts.origin ?? ORIGIN;
  const req = new Request(`${ORIGIN}/api/x`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  return handler(req, { params: Promise.resolve(opts.params ?? {}) });
}

const cookieFrom = (res: Response) => res.headers.get('set-cookie')!.split(';')[0];

async function signUp(email: string) {
  const res = await call(auth.signup, 'POST', { body: { email, password: 'correct horse', displayName: email.split('@')[0], inviteCode: 'let-me-in' } });
  expect(res.status).toBe(201);
  return cookieFrom(res);
}

describe('accounts', () => {
  it('requires the invite code, then signs in and out', async () => {
    const bad = await call(auth.signup, 'POST', { body: { email: 'a@x.io', password: 'correct horse', displayName: 'A', inviteCode: 'nope' } });
    expect(bad.status).toBe(403);
    const cookie = await signUp('a@x.io');
    expect(cookie).toMatch(/^gs_session=/);
    const dup = await call(auth.signup, 'POST', { body: { email: 'A@x.io', password: 'correct horse', displayName: 'A', inviteCode: 'let-me-in' } });
    expect(dup.status).toBe(409);

    const me = await (await call(auth.me, 'GET', { cookie })).json();
    expect(me.user.email).toBe('a@x.io');
    expect((await call(auth.login, 'POST', { body: { email: 'a@x.io', password: 'wrong password' } })).status).toBe(401);
    const login = await call(auth.login, 'POST', { body: { email: 'a@x.io', password: 'correct horse' } });
    expect(login.status).toBe(200);
    await call(auth.logout, 'POST', { cookie, body: {} });
    expect((await (await call(auth.me, 'GET', { cookie })).json()).user).toBeNull();
  });

  it('refuses changes from other sites and without an Origin', async () => {
    const cookie = await signUp('b@x.io');
    expect((await call(projects.create, 'POST', { cookie, body: {}, origin: 'https://evil.example' })).status).toBe(403);
    expect((await call(projects.create, 'POST', { cookie, body: {}, origin: null })).status).toBe(403);
    expect((await call(projects.list, 'GET', {})).status).toBe(401);
  });
});

describe('projects', () => {
  it('creates from an example, saves with version checks, and hides projects from other users', async () => {
    const alice = await signUp('alice@x.io');
    const bob = await signUp('bob@x.io');
    const created = await (await call(projects.create, 'POST', { cookie: alice, body: { from: { kind: 'example', slug: 'fit-a-line' } } })).json();
    const params = { pid: created.id, bid: created.branchId };

    const list = await (await call(projects.list, 'GET', { cookie: alice })).json();
    expect(list.projects[0].title).toBe('Fit a line');
    expect(list.projects[0].thumb.n.length).toBeGreaterThan(3);

    const working = await (await call(projects.getWorkingDoc, 'GET', { cookie: alice, params })).json();
    expect(working.version).toBe(1);
    expect(Object.keys(working.doc.nodes).length).toBe(Object.keys(fitALine.build().nodes).length);

    const doc = { ...working.doc, info: { description: 'edited' } };
    const saved = await call(projects.putWorkingDoc, 'PUT', { cookie: alice, params, body: { doc, baseVersion: 1 } });
    expect(await saved.json()).toEqual({ version: 2 });
    const stale = await call(projects.putWorkingDoc, 'PUT', { cookie: alice, params, body: { doc, baseVersion: 1 } });
    expect(stale.status).toBe(409);
    expect((await stale.json()).version).toBe(2);
    const forced = await call(projects.putWorkingDoc, 'PUT', { cookie: alice, params, body: { doc, baseVersion: 1, force: true } });
    expect((await forced.json()).version).toBe(3);

    expect((await call(projects.get, 'GET', { cookie: bob, params: { pid: created.id } })).status).toBe(404);
    expect((await call(projects.putWorkingDoc, 'PUT', { cookie: bob, params, body: { doc, baseVersion: 3 } })).status).toBe(404);
    expect((await call(projects.remove, 'DELETE', { cookie: bob, params: { pid: created.id } })).status).toBe(404);

    const bad = await call(projects.putWorkingDoc, 'PUT', { cookie: alice, params, body: { doc: { nope: true }, baseVersion: 3 } });
    expect(bad.status).toBe(400);

    expect((await call(projects.remove, 'DELETE', { cookie: alice, params: { pid: created.id } })).status).toBe(200);
    expect((await (await call(projects.list, 'GET', { cookie: alice })).json()).projects).toHaveLength(0);
  });
});

describe('node library', () => {
  it('saves a group and lists it only for its owner', async () => {
    const carol = await signUp('carol@x.io');
    const dave = await signUp('dave@x.io');
    const b = new DocBuilder();
    const g = b.group('Doubler', (inner) => {
      const x = inner.input('x');
      const two = inner.add('value', { value: { shape: [], data: [2] } });
      const m = inner.add('multiply');
      inner.wire(x, m, 'a');
      inner.wire(two, m, 'b');
      inner.wire(m, inner.output('y'), 'in');
    });
    const subtree = extractSubtree(b.build(), g);
    const res = await call(library.create, 'POST', { cookie: carol, body: { name: 'Doubler', subtree } });
    expect(res.status).toBe(201);
    const mine = await (await call(library.list, 'GET', { cookie: carol })).json();
    expect(mine.nodes.map((n: { name: string }) => n.name)).toEqual(['Doubler']);
    expect((await (await call(library.list, 'GET', { cookie: dave })).json()).nodes).toEqual([]);
    const broken = { ...subtree, root: 'missing' };
    expect((await call(library.create, 'POST', { cookie: carol, body: { name: 'x', subtree: broken } })).status).toBe(400);
  });
});

describe('version control', () => {
  it('commits snapshots, branches from a commit, and keeps branches independent', async () => {
    const erin = await signUp('erin@x.io');
    const mallory = await signUp('mallory@x.io');
    const created = await (await call(projects.create, 'POST', { cookie: erin, body: { from: { kind: 'example', slug: 'fit-a-line' } } })).json();
    const pid = created.id;
    const main = created.branchId;
    const w1 = await (await call(projects.getWorkingDoc, 'GET', { cookie: erin, params: { pid, bid: main } })).json();

    // A commit must include the latest save.
    expect((await call(vcs.commit, 'POST', { cookie: erin, params: { pid, bid: main }, body: { message: 'first', expectVersion: 0 } })).status).toBe(409);
    const c1 = (await (await call(vcs.commit, 'POST', { cookie: erin, params: { pid, bid: main }, body: { message: 'first', expectVersion: w1.version } })).json()).commit;
    expect(c1.id).toMatch(/^[0-9a-f]{12}$/);
    expect(c1.parentId).toBeNull();

    const edited = { ...w1.doc, info: { description: 'second version' } };
    const v2 = (await (await call(projects.putWorkingDoc, 'PUT', { cookie: erin, params: { pid, bid: main }, body: { doc: edited, baseVersion: w1.version } })).json()).version;
    const c2 = (await (await call(vcs.commit, 'POST', { cookie: erin, params: { pid, bid: main }, body: { message: 'second', expectVersion: v2 } })).json()).commit;
    expect(c2.parentId).toBe(c1.id);

    const branch = (await (await call(vcs.newBranch, 'POST', { cookie: erin, params: { pid }, body: { name: 'experiment', fromCommitId: c1.id } })).json()).branch;
    const bw = await (await call(projects.getWorkingDoc, 'GET', { cookie: erin, params: { pid, bid: branch.id } })).json();
    expect(bw.doc.info.description).toBe(w1.doc.info.description);
    const c3 = (await (await call(vcs.commit, 'POST', { cookie: erin, params: { pid, bid: branch.id }, body: { message: 'on branch', expectVersion: bw.version } })).json()).commit;
    expect(c3.parentId).toBe(c1.id);

    const hist = await (await call(vcs.history, 'GET', { cookie: erin, params: { pid } })).json();
    expect(hist.commits.map((c: { message: string }) => c.message)).toEqual(['first', 'second', 'on branch']);
    expect(hist.branches.map((b: { name: string }) => b.name)).toEqual(['main', 'experiment']);
    const old = await (await call(vcs.commitDoc, 'GET', { cookie: erin, params: { pid, cid: c2.id } })).json();
    expect(old.doc.info.description).toBe('second version');

    expect((await call(vcs.newBranch, 'POST', { cookie: erin, params: { pid }, body: { name: 'experiment', fromCommitId: c1.id } })).status).toBe(409);
    expect((await call(vcs.history, 'GET', { cookie: mallory, params: { pid } })).status).toBe(404);
    expect((await call(vcs.commitDoc, 'GET', { cookie: mallory, params: { pid, cid: c1.id } })).status).toBe(404);

    expect((await call(vcs.removeBranch, 'DELETE', { cookie: erin, params: { pid, bid: main } })).status).toBe(200);
    expect((await call(vcs.removeBranch, 'DELETE', { cookie: erin, params: { pid, bid: branch.id } })).status).toBe(400);
    const info = await (await call(projects.get, 'GET', { cookie: erin, params: { pid } })).json();
    expect(info.project.defaultBranchId).toBe(branch.id);
  });
});

describe('share links', () => {
  it('shares a frozen snapshot publicly, forks it, and revokes it', async () => {
    const owner = await signUp('owner@x.io');
    const friend = await signUp('friend@x.io');
    const created = await (await call(projects.create, 'POST', { cookie: owner, body: { from: { kind: 'example', slug: 'xor-mlp' } } })).json();
    const share = (await (await call(shares.create, 'POST', { cookie: owner, params: { pid: created.id }, body: { branchId: created.branchId } })).json()).share;
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect((await call(shares.create, 'POST', { cookie: friend, params: { pid: created.id }, body: { branchId: created.branchId } })).status).toBe(404);

    // Later edits don't change what the link shows.
    const w = await (await call(projects.getWorkingDoc, 'GET', { cookie: owner, params: { pid: created.id, bid: created.branchId } })).json();
    await call(projects.putWorkingDoc, 'PUT', { cookie: owner, params: { pid: created.id, bid: created.branchId }, body: { doc: { ...w.doc, info: { description: 'changed later' } }, baseVersion: w.version } });
    const pub = await (await call(shares.get, 'GET', { params: { token: share.token } })).json();
    expect(pub.author).toBe('owner');
    expect(pub.doc.info.description).not.toBe('changed later');

    expect((await call(shares.fork, 'POST', { params: { token: share.token }, body: {} })).status).toBe(401);
    const forked = await (await call(shares.fork, 'POST', { cookie: friend, params: { token: share.token }, body: {} })).json();
    const friendsProjects = (await (await call(projects.list, 'GET', { cookie: friend })).json()).projects;
    expect(friendsProjects.map((p: { id: string }) => p.id)).toContain(forked.id);

    expect((await call(shares.revoke, 'DELETE', { cookie: friend, params: { token: share.token } })).status).toBe(404);
    expect((await call(shares.revoke, 'DELETE', { cookie: owner, params: { token: share.token } })).status).toBe(200);
    expect((await call(shares.get, 'GET', { params: { token: share.token } })).status).toBe(404);
  });
});
