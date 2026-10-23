'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import styles from './site.module.css';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Avatar, email and a Logout button (as in the mockup header). */
export function UserMenu({ user }: { user: { email: string; displayName: string } }) {
  const router = useRouter();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span className={styles.avatar} title={user.displayName}>
        {initials(user.displayName)}
      </span>
      <span className={styles.muted}>{user.email}</span>
      <button
        className={styles.secondary}
        onClick={async () => {
          await api('/api/auth/logout', { body: {} }).catch(() => undefined);
          router.replace('/');
          router.refresh();
        }}
      >
        Logout
      </button>
    </span>
  );
}
