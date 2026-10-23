'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import styles from './site.module.css';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      const body = Object.fromEntries(form.entries());
      await api(`/api/auth/${mode}`, { body });
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the server.');
      setBusy(false);
    }
  }

  return (
    <div className={styles.card}>
      <h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
      <form className={styles.form} action={submit}>
        {mode === 'signup' && (
          <label>
            Name
            <input name="displayName" required maxLength={60} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={mode === 'signup' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {mode === 'signup' && (
          <label>
            Invite code
            <input name="inviteCode" required autoComplete="off" />
          </label>
        )}
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <button className={styles.primary} disabled={busy}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className={styles.muted}>
          {mode === 'login' ? (
            <>
              New here? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link> (you need an invite code).
            </>
          ) : (
            <>
              Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</Link>.
            </>
          )}
        </p>
      </form>
    </div>
  );
}
