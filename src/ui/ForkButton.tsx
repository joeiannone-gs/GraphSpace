'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import styles from './editor.module.css';

/** Copy a shared project or example into the user's own projects (signing in first if needed). */
export function ForkButton({ signedIn, from, returnTo }: { signedIn: boolean; from: { share: string } | { example: string }; returnTo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={styles.primary}
      disabled={busy}
      onClick={async () => {
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(returnTo)}`);
          return;
        }
        setBusy(true);
        try {
          const res =
            'share' in from
              ? await api<{ id: string }>(`/api/shares/${from.share}/fork`, { body: {} })
              : await api<{ id: string }>('/api/projects', { body: { from: { kind: 'example', slug: from.example } } });
          router.push(`/p/${res.id}`);
        } catch (e) {
          alert(e instanceof ApiError ? e.message : 'Could not make a copy.');
          setBusy(false);
        }
      }}
    >
      Fork to my GraphSpace
    </button>
  );
}
