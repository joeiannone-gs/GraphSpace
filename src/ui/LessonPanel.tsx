'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getLesson, solvedThrough } from '@/lessons';
import { runStructureChecks } from '@/lessons/runner';
import type { CheckResult } from '@/lessons/types';
import { docActions } from '@/store/docSlice';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import { EngineClient } from '@/worker/client';
import { Markdown } from './Markdown';
import styles from './editor.module.css';

export interface LessonProgress {
  step: number;
  completed: boolean;
}

const ICON: Record<CheckResult['status'], string> = { pass: '✓', fail: '✗', skipped: '·' };

/** The lesson's current step, its live checklist and the buttons to check, get help and move on. */
export function LessonPanel({ lessonId, progress, onProgress }: { lessonId: string; progress: LessonProgress; onProgress(p: LessonProgress): void }) {
  const lesson = getLesson(lessonId)!;
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const doc = useAppSelector((s) => s.doc.present);
  const [stepIndex, setStepIndex] = useState(Math.min(progress.step, lesson.steps.length - 1));
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [checkedDoc, setCheckedDoc] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const checker = useRef<EngineClient | null>(null);
  const step = lesson.steps[stepIndex];

  useEffect(() => {
    // Checks run in their own worker so they never disturb the learner's live model.
    const client = new EngineClient({ snapshot: () => undefined, status: () => undefined, error: () => undefined });
    checker.current = client;
    return () => {
      client.dispose();
      checker.current = null;
    };
  }, []);

  // Structure checks update as you edit; value and training checks wait for "Check my work".
  const live = runStructureChecks(step, doc);
  const stale = checkedDoc !== doc;
  const rows: CheckResult[] = step.checks.map((c, i) => {
    if (c.kind === 'structure') return live.get(c)!;
    if (results && !stale) return results[i];
    return { describe: c.describe, status: 'skipped' };
  });
  const allPass = !stale && results !== null && results.every((r) => r.status === 'pass');
  const last = stepIndex === lesson.steps.length - 1;

  async function check() {
    if (!checker.current) return;
    setRunning(true);
    const current = store.getState().doc.present;
    const r = await checker.current.runChecks(lesson.id, stepIndex, current);
    setResults(r);
    setCheckedDoc(current);
    setRunning(false);
    if (r.every((x) => x.status === 'pass') && last && !progress.completed) onProgress({ step: stepIndex, completed: true });
  }

  function go(next: number) {
    setStepIndex(next);
    setResults(null);
    setShowHint(false);
    if (next > progress.step) onProgress({ step: next, completed: progress.completed });
  }

  return (
    <div className={styles.panel} data-testid="lesson-panel">
      <div className={styles.panelHeader}>
        <Link href="/learn" style={{ textDecoration: 'none' }}>
          Lessons
        </Link>
        <span className={styles.muted}>
          Step {stepIndex + 1} of {lesson.steps.length}
        </span>
      </div>
      <div className={styles.inspector}>
        <h3 className={styles.panelHeading}>{lesson.title}</h3>
        <div className={styles.row} aria-label="Steps">
          {lesson.steps.map((s, i) => (
            <button
              key={s.title}
              className={styles.stepDot}
              data-state={i === stepIndex ? 'current' : i <= progress.step ? 'done' : 'todo'}
              disabled={i > progress.step}
              onClick={() => go(i)}
              title={s.title}
              aria-label={`Step ${i + 1}: ${s.title}`}
            />
          ))}
        </div>
        <h4 style={{ margin: '8px 0 4px', fontWeight: 400, fontSize: 16 }}>{step.title}</h4>
        <Markdown>{step.body}</Markdown>
        <ul className={styles.checklist} aria-label="Checks">
          {rows.map((r, i) => (
            <li key={i} data-status={r.status}>
              <span aria-hidden>{ICON[r.status]}</span> {r.describe}
              {r.status === 'fail' && r.detail && <div className={styles.fieldHelp}>{r.detail}</div>}
            </li>
          ))}
        </ul>
        <div className={styles.row} style={{ flexWrap: 'wrap' }}>
          <button className={styles.primary} onClick={check} disabled={running}>
            {running ? 'Checking…' : 'Check my work'}
          </button>
          {allPass && !last && (
            <button className={styles.button} onClick={() => go(stepIndex + 1)}>
              Next step →
            </button>
          )}
          {step.hint && (
            <button className={styles.linkButton} onClick={() => setShowHint((h) => !h)}>
              {showHint ? 'Hide hint' : 'Hint'}
            </button>
          )}
          <button
            className={styles.linkButton}
            onClick={() => {
              if (!confirm('Replace your graph with a worked solution for this step? (You can undo with Ctrl+Z.)')) return;
              dispatch(docActions.replaceDoc({ doc: solvedThrough(lesson, stepIndex + 1), keepHistory: true }));
              dispatch(uiActions.setScope(null));
            }}
          >
            Show me
          </button>
        </div>
        {showHint && step.hint && <div className={styles.notice}>{step.hint}</div>}
        {allPass && last && (
          <div className={styles.notice} role="status">
            Lesson complete! <Link href="/learn">Choose the next lesson</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
