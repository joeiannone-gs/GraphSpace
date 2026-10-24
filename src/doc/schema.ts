/** Runtime validation of documents arriving from the network, storage or files. */
import { z } from 'zod';
import type { ProjectDoc } from './types';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const finite = z.number().refine(Number.isFinite, 'must be a finite number');

export const tensorJSONSchema = z
  .object({
    shape: z.array(z.number().int().min(0)).max(8),
    data: z.array(finite),
  })
  .refine((t) => t.shape.reduce((a, b) => a * b, 1) === t.data.length, 'data length must match shape');

const portRef = z.object({ node: id, port: z.string().min(1).max(40) });

export const nodeSchema = z.object({
  id,
  type: z.string().min(1).max(40),
  parent: id.nullable(),
  pos: z.tuple([finite, finite]),
  label: z.string().max(200).optional(),
  note: z.string().max(20_000).optional(),
  params: z.record(z.string(), z.unknown()),
  source: z
    .object({
      kind: z.enum(['builtin', 'user']),
      id: z.string().max(80),
      version: z.number().int(),
      params: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
});

export const edgeSchema = z.object({
  id,
  from: portRef,
  to: portRef,
  kind: z.literal('feedback').optional(),
});

export const projectDocSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z.record(id, nodeSchema),
  edges: z.record(id, edgeSchema),
  training: z.object({
    optimizer: z.enum(['sgd', 'adam']),
    lr: z.number().positive().max(10),
    steps: z.number().int().min(1).max(1_000_000),
    seed: z.number().int(),
    momentum: z.number().min(0).max(1),
  }),
  generate: z.object({ steps: z.number().int().min(1).max(10_000) }),
  layout: z.object({ direction: z.enum(['up', 'right']), edges: z.enum(['auto', 'orthogonal', 'straight']).optional() }),
  info: z.object({ description: z.string().max(50_000) }),
}) satisfies z.ZodType<ProjectDoc>;

/** Structural checks zod can't express: keys match ids, parents and edge endpoints exist. */
export function checkDocIntegrity(doc: ProjectDoc): string[] {
  const problems: string[] = [];
  for (const [key, node] of Object.entries(doc.nodes)) {
    if (key !== node.id) problems.push(`node key ${key} != id ${node.id}`);
    if (node.parent !== null && !doc.nodes[node.parent]) problems.push(`node ${key} has missing parent ${node.parent}`);
  }
  for (const [key, edge] of Object.entries(doc.edges)) {
    if (key !== edge.id) problems.push(`edge key ${key} != id ${edge.id}`);
    for (const end of [edge.from, edge.to]) {
      if (!doc.nodes[end.node]) problems.push(`edge ${key} points at missing node ${end.node}`);
    }
  }
  // parent chains must terminate
  for (const node of Object.values(doc.nodes)) {
    const seen = new Set<string>();
    let cur: string | null = node.id;
    while (cur !== null) {
      if (seen.has(cur)) {
        problems.push(`node ${node.id} is inside itself`);
        break;
      }
      seen.add(cur);
      cur = doc.nodes[cur]?.parent ?? null;
    }
  }
  return problems;
}

export function parseDoc(input: unknown): ProjectDoc {
  const doc = projectDocSchema.parse(input) as ProjectDoc;
  const problems = checkDocIntegrity(doc);
  if (problems.length) throw new Error(`Invalid document: ${problems.slice(0, 3).join('; ')}`);
  return doc;
}

/** A group and its contents, as saved to the Nodes library. */
export const subtreeSchema = z
  .object({ root: id, nodes: z.record(id, nodeSchema), edges: z.record(id, edgeSchema) })
  .superRefine((sub, ctx) => {
    const root = sub.nodes[sub.root];
    if (!root || root.type !== 'composite' || root.parent !== null) ctx.addIssue({ code: 'custom', message: 'root must be a top-level group' });
    for (const n of Object.values(sub.nodes)) {
      if (n.id !== sub.root && (n.parent === null || !sub.nodes[n.parent])) ctx.addIssue({ code: 'custom', message: `node ${n.id} is outside the group` });
    }
    for (const e of Object.values(sub.edges)) {
      if (!sub.nodes[e.from.node] || !sub.nodes[e.to.node]) ctx.addIssue({ code: 'custom', message: `edge ${e.id} leaves the group` });
    }
  });
