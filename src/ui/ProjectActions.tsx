'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import styles from './site.module.css';

/** Create a project (blank or from an example) and open it. */
export function NewProjectButton({ from, label, className }: { from: { kind: 'blank' } | { kind: 'example'; slug: string }; label: React.ReactNode; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className ?? styles.primary}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await api<{ id: string }>('/api/projects', { body: { from } });
          router.push(`/p/${id}`);
        } catch (e) {
          alert(e instanceof ApiError ? e.message : 'Could not create the project.');
          setBusy(false);
        }
      }}
    >
      {label}
    </button>
  );
}
