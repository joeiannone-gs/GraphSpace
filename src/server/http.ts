/**
 * Route handler plumbing: JSON in/out, zod validation, readable errors, same-origin checks for
 * changes (CSRF), and the signed-in user. Handlers take plain Request objects so tests can call them.
 */
import { ZodError, type ZodType } from 'zod';
import { SESSION_COOKIE, SESSION_DAYS, User, userForSession } from './auth';
import { Db, getDb } from './db';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = () => new HttpError(404, 'Not found');

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function isHttps(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  return proto === 'https';
}

export function sessionCookie(req: Request, token: string, expires: Date): string {
  const parts = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_DAYS * 24 * 3600}`, `Expires=${expires.toUTCString()}`];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(req: Request): string {
  return [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', ...(isHttps(req) ? ['Secure'] : [])].join('; ');
}

/** Changes must come from our own pages: same Origin as the request's host, JSON body. */
function checkSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) throw new HttpError(403, 'Missing Origin header');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host;
  if (new URL(origin).host !== host) throw new HttpError(403, 'Cross-site request refused');
}

export async function readJson<T>(req: Request, schema: ZodType<T>, maxBytes = 5 * 1024 * 1024): Promise<T> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected JSON');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
  return schema.parse(raw);
}

export const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, init);

export interface RouteContext {
  req: Request;
  db: Db;
  user: User | null;
  params: Record<string, string>;
}

type Handler = (ctx: RouteContext) => Promise<Response> | Response;

/** Wrap a handler: errors become JSON responses; `auth: true` requires a signed-in user. */
export function route(handler: Handler, opts: { auth?: boolean } = {}) {
  return async (req: Request, ctx?: { params?: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) checkSameOrigin(req);
      const db = getDb();
      const user = userForSession(db, readCookie(req, SESSION_COOKIE));
      if (opts.auth && !user) throw new HttpError(401, 'Please sign in');
      const params = (await ctx?.params) ?? {};
      return await handler({ req, db, user, params });
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...err.body }, { status: err.status });
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return json({ error: `${issue.path.join('.') || 'body'}: ${issue.message}` }, { status: 400 });
      }
      console.error(err);
      return json({ error: 'Something went wrong' }, { status: 500 });
    }
  };
}

export function requireUser(ctx: RouteContext): User {
  if (!ctx.user) throw new HttpError(401, 'Please sign in');
  return ctx.user;
}

export const idParam = (value: string | undefined): string => {
  if (!value || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw notFound();
  return value;
};

export { getDb };
