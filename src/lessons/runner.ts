/**
 * Runs a lesson step's checks: structure first, then values (one evaluation), then training (one
 * seeded run long enough for every train check). Later kinds are skipped while earlier ones fail.
 */
import type { ProjectDoc } from '@/doc/types';
import type { FetchBytes } from '@/engine/datasets';
import { Session } from '@/engine/session';
import { GraphQuery } from '@/graph/query';
import type { Check, CheckResult, Step } from './types';

function outcome(c: Check, r: boolean | string): CheckResult {
  if (r === true) return { describe: c.describe, status: 'pass' };
  return { describe: c.describe, status: 'fail', detail: typeof r === 'string' ? r : undefined };
}

function safely(c: Check, run: () => boolean | string): CheckResult {
  try {
    return outcome(c, run());
  } catch (e) {
    return { describe: c.describe, status: 'fail', detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function runChecks(step: Step, doc: ProjectDoc, fetchBytes: FetchBytes): Promise<CheckResult[]> {
  const q = new GraphQuery(doc);
  const results = new Map<Check, CheckResult>();
  const of = (kind: Check['kind']) => step.checks.filter((c) => c.kind === kind);
  const skip = (cs: Check[]) => cs.forEach((c) => results.set(c, { describe: c.describe, status: 'skipped' }));

  for (const c of of('structure')) results.set(c, safely(c, () => c.test({ doc, q })));
  const structureOk = of('structure').every((c) => results.get(c)!.status === 'pass');

  if (!structureOk) {
    skip(of('value'));
    skip(of('train'));
  } else {
    if (of('value').length) {
      const session = new Session(fetchBytes);
      await session.load(doc);
      session.evaluate();
      for (const c of of('value')) results.set(c, safely(c, () => c.test({ doc, q, session })));
    }
    const valuesOk = of('value').every((c) => results.get(c)!.status === 'pass');
    const train = of('train');
    if (!valuesOk) skip(train);
    else if (train.length) {
      const session = new Session(fetchBytes);
      await session.load(doc);
      const steps = Math.max(...train.map((c) => (c.kind === 'train' ? c.steps : 0)));
      let stalled = false;
      for (let i = 0; i < steps; i++) {
        if (session.trainStep() === null) {
          stalled = true;
          break;
        }
      }
      session.evaluate();
      for (const c of train) {
        results.set(c, stalled ? { describe: c.describe, status: 'fail', detail: 'Training could not run — is a Minimize node connected to a loss?' } : safely(c, () => c.test({ doc, q, session })));
      }
    }
  }
  return step.checks.map((c) => results.get(c)!);
}

/** Only the instant structure checks (run live while the learner edits). */
export function runStructureChecks(step: Step, doc: ProjectDoc): Map<Check, CheckResult> {
  const q = new GraphQuery(doc);
  const out = new Map<Check, CheckResult>();
  for (const c of step.checks) if (c.kind === 'structure') out.set(c, safely(c, () => c.test({ doc, q })));
  return out;
}
