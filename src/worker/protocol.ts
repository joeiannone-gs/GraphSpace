/** Messages between the editor (main thread) and the engine worker. */
import type { Id, ProjectDoc, TensorJSON } from '@/doc/types';
import type { SessionSnapshot } from '@/engine/session';

export type EngineState = 'idle' | 'training' | 'paused' | 'done';

export type ToWorker =
  /** A new version of the document. Re-evaluates; if the model's structure changed, training pauses. */
  | { t: 'load'; version: number; doc: ProjectDoc }
  /** Train until `doc.training.steps` total steps (or until paused). */
  | { t: 'train' }
  | { t: 'pause' }
  | { t: 'step'; n: number }
  /** Forget trained values and start over. */
  | { t: 'reset' }
  | { t: 'generate'; steps: number }
  | { t: 'getParams'; requestId: number };

export type FromWorker =
  | { t: 'status'; state: EngineState; step: number; notice?: string }
  | { t: 'snapshot'; version: number; snapshot: SessionSnapshot }
  | { t: 'params'; requestId: number; values: Record<Id, TensorJSON> }
  | { t: 'error'; message: string };

/**
 * The parts of a document that change what the model computes. Moving or renaming nodes doesn't
 * change it, so those edits never interrupt training.
 */
export function modelSignature(doc: ProjectDoc): string {
  const nodes = Object.values(doc.nodes)
    .map((n) => [n.id, n.type, n.parent, n.params] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const edges = Object.values(doc.edges)
    .map((e) => [e.from.node, e.from.port, e.to.node, e.to.port, e.kind ?? ''] as const)
    .sort((a, b) => (a.join() < b.join() ? -1 : 1));
  return JSON.stringify([nodes, edges, doc.training.seed]);
}
