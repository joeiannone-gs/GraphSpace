import { z } from 'zod';
import { env } from '@/lib/env';
import { checkLogin, clearLoginFailures, createSession, createUser, deleteSession, loginAllowed, noteLoginFailure, safeEqual, SESSION_COOKIE } from '../auth';
import { HttpError, clearSessionCookie, json, readCookie, readJson, route, sessionCookie } from '../http';

const email = z.string().trim().toLowerCase().email().max(200);
const password = z.string().min(8, 'Use at least 8 characters').max(200);

export const signup = route(async ({ req, db }) => {
  const body = await readJson(
    req,
    z.object({ email, password, displayName: z.string().trim().min(1).max(60), inviteCode: z.string().max(200) }),
  );
  const invite = process.env.INVITE_CODE ?? env.inviteCode;
  if (!invite) throw new HttpError(403, 'Sign-up is closed. Ask for an account.');
  if (!safeEqual(body.inviteCode, invite)) throw new HttpError(403, 'That invite code is not right.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email)) throw new HttpError(409, 'An account with that email already exists.');
  const user = await createUser(db, body.email, body.password, body.displayName);
  const session = createSession(db, user.id);
  return json({ user }, { status: 201, headers: { 'Set-Cookie': sessionCookie(req, session.token, session.expires) } });
});

export const login = route(async ({ req, db }) => {
  const body = await readJson(req, z.object({ email, password: z.string().max(200) }));
  const key = `${req.headers.get('x-forwarded-for') ?? 'local'}|${body.email}`;
  if (!loginAllowed(key)) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  const user = await checkLogin(db, body.email, body.password);
  if (!user) {
    noteLoginFailure(key);
    throw new HttpError(401, 'Wrong email or password.');
  }
  clearLoginFailures(key);
  const session = createSession(db, user.id);
  return json({ user }, { headers: { 'Set-Cookie': sessionCookie(req, session.token, session.expires) } });
});

export const logout = route(({ req, db }) => {
  deleteSession(db, readCookie(req, SESSION_COOKIE));
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(req) } });
});

export const me = route(({ user }) => json({ user }));
