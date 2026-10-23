'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import styles from './site.module.css';

/** Start (or continue) a lesson in its own project. */
export function LessonStart({ lessonId, label }: { lessonId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={styles.primary}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { projectId } = await api<{ projectId: string }>(`/api/lessons/${lessonId}/start`, { body: {} });
        router.push(`/p/${projectId}`);
      }}
    >
      {label}
    </button>
  );
}
