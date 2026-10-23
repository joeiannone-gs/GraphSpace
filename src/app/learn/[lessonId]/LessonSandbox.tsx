'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getLesson } from '@/lessons';
import { EditorProvider } from '@/ui/EditorContext';
import { EditorShell } from '@/ui/EditorShell';
import { LessonPanel, type LessonProgress } from '@/ui/LessonPanel';
import { useLocalPersistence } from '@/ui/useLocalPersistence';

function readProgress(key: string): LessonProgress {
  try {
    const p = JSON.parse(localStorage.getItem(key) ?? '') as LessonProgress;
    return typeof p.step === 'number' ? p : { step: 0, completed: false };
  } catch {
    return { step: 0, completed: false };
  }
}

function Inner({ lessonId }: { lessonId: string }) {
  const lesson = getLesson(lessonId)!;
  const starter = useCallback(() => lesson.starter(), [lesson]);
  useLocalPersistence(`graphspace:lesson:${lessonId}`, starter);
  const key = `graphspace:lesson-progress:${lessonId}`;
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  useEffect(() => {
    // localStorage is only readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(readProgress(key));
  }, [key]);
  return (
    <EditorShell
      headerRight={<Link href={`/login?next=/learn`}>Sign in to save progress</Link>}
      left={
        progress && (
        <LessonPanel
          lessonId={lessonId}
          progress={progress}
          onProgress={(p) => {
            setProgress(p);
            try {
              localStorage.setItem(key, JSON.stringify(p));
            } catch {
              // Not saved; fine for a try-out.
            }
          }}
        />
        )
      }
      paletteFilter={lesson.palette}
    />
  );
}

/** A lesson without an account: work is kept in this browser only. */
export function LessonSandbox({ lessonId }: { lessonId: string }) {
  return (
    <EditorProvider>
      <Inner lessonId={lessonId} />
    </EditorProvider>
  );
}
