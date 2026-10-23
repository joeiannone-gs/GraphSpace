import type { ProjectDoc } from '@/doc/types';
import type { Session } from '@/engine/session';
import type { GraphQuery } from '@/graph/query';

export interface CheckContext {
  doc: ProjectDoc;
  q: GraphQuery;
  /** Present for value checks (evaluated) and train checks (trained). */
  session?: Session;
}

/** Returns true when satisfied, or a short hint explaining what's missing. */
export type CheckFn = (ctx: CheckContext) => boolean | string;

export type Check =
  | { kind: 'structure'; describe: string; test: CheckFn }
  | { kind: 'value'; describe: string; test: CheckFn }
  | { kind: 'train'; describe: string; steps: number; test: CheckFn }
  /** Train, then run `generate` feedback iterations before testing. */
  | { kind: 'generate'; describe: string; steps: number; generate: number; test: CheckFn };

export interface Step {
  title: string;
  /** Markdown. */
  body: string;
  checks: Check[];
  hint?: string;
  /** Builds a document that passes this step from one that passed the previous step. */
  solve(doc: ProjectDoc): ProjectDoc;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  /** Node types and `group:<id>` palette keys available in this lesson. */
  palette?: string[];
  starter(): ProjectDoc;
  steps: Step[];
}

export interface CheckResult {
  describe: string;
  status: 'pass' | 'fail' | 'skipped';
  detail?: string;
}
