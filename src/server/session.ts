import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, userForSession, type User } from './auth';
import { getDb } from './db';

/** The signed-in user for server components and pages. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userForSession(getDb(), token);
}
