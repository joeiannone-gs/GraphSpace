import type { Metadata } from 'next';
import Link from 'next/link';
import { lessons } from '@/lessons';
import { getDb } from '@/server/db';
import { listProgress } from '@/server/repo/lessons';
import { currentUser } from '@/server/session';
import { LessonStart } from '@/ui/LessonStart';
import { SiteBar } from '@/ui/SiteBar';
import styles from '@/ui/site.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Lessons · GraphSpace' };

export default async function LearnPage() {
  const user = await currentUser();
  const progress = user ? listProgress(getDb(), user.id) : [];
  return (
    <div className={styles.page}>
      <SiteBar user={user} />
      <main className={styles.main}>
        <h1 style={{ fontWeight: 400 }}>Lessons</h1>
        <p className={styles.muted}>
          Each lesson builds on the one before. {user ? 'Your progress is saved.' : 'Sign in to save your progress; or just try one.'}
        </p>
        <ol style={{ display: 'grid', gap: 12, padding: 0, listStyle: 'none' }}>
          {lessons.map((l, i) => {
            const p = progress.find((x) => x.lessonId === l.id);
            const status = p?.completed ? 'Completed' : p ? `Step ${p.step + 1} of ${l.steps.length}` : `${l.steps.length} steps · ~${l.minutes} min`;
            return (
              <li key={l.id} className={styles.tile} style={{ cursor: 'default' }} data-testid={`lesson-${l.id}`}>
                <span className={styles.tileTitle}>
                  {i + 1}. {l.title}
                </span>
                <span className={styles.muted}>{l.summary}</span>
                <span className={styles.muted}>{status}</span>
                <span>
                  {user ? (
                    <LessonStart lessonId={l.id} label={p ? (p.completed ? 'Open again' : 'Continue') : 'Start'} />
                  ) : (
                    <Link className={styles.primary} href={`/learn/${l.id}`}>
                      Try it
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}
