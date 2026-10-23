/** Small helpers for writing lessons. */
import { DocBuilder } from '@/doc/builder';
import type { DocNode, ProjectDoc } from '@/doc/types';
import type { CheckContext } from './types';

/** First node with this label (or type). */
export function find(doc: ProjectDoc, labelOrType: string): DocNode {
  const n =
    Object.values(doc.nodes).find((x) => x.label === labelOrType) ?? Object.values(doc.nodes).find((x) => x.type === labelOrType);
  if (!n) throw new Error(`No node "${labelOrType}"`);
  return n;
}

/** Edit a copy of a document with the builder. */
export function extend(doc: ProjectDoc, edit: (b: DocBuilder, doc: ProjectDoc) => void): ProjectDoc {
  const b = new DocBuilder(structuredClone(doc));
  edit(b, b.doc);
  return b.build();
}

export const scalarOf = (ctx: CheckContext, id: string, port = 'out') => ctx.session?.valueOf(id, port)?.data[0];

/** The accuracy of the first Accuracy node, after training. */
export function accuracy(ctx: CheckContext): number | undefined {
  const acc = ctx.q.nodes('accuracy')[0];
  return acc ? scalarOf(ctx, acc.id) : undefined;
}

export const pct = (v: number | undefined) => (v === undefined ? 'unknown' : `${Math.round(v * 100)}%`);
