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
