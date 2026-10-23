import { classifyDigits } from './defs/classifyDigits';
import { fitALineLesson } from './defs/fitALine';
import { neuronsToMlp } from './defs/neuronsToMlp';
import { valuesFlow } from './defs/valuesFlow';
import type { Lesson } from './types';

/** Lessons in teaching order: each builds on the one before. */
export const lessons: Lesson[] = [valuesFlow, fitALineLesson, neuronsToMlp, classifyDigits];

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}

/** The document after applying the solutions of the first `steps` steps (for "Show me"). */
export function solvedThrough(lesson: Lesson, steps: number) {
  let doc = lesson.starter();
  for (const step of lesson.steps.slice(0, steps)) doc = step.solve(doc);
  return doc;
}
