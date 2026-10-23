/** Every node type, in palette order. Adding a node type means adding a definition here. */
import type { DocNode, ProjectDoc } from '@/doc/types';
import * as data from './defs/data';
import * as display from './defs/display';
import * as linalg from './defs/linalg';
import * as loss from './defs/loss';
import * as math from './defs/math';
import * as structure from './defs/structure';
import * as text from './defs/text';
import type { NodeDef, PortDef } from './types';

const ALL: NodeDef<never>[] = [
  data.value,
  data.parameter,
  data.dataset,
  data.previous,
  math.add,
  math.subtract,
  math.multiply,
  math.divide,
  math.negate,
  math.square,
  math.sqrt,
  math.exp,
  math.log,
  math.sin,
  math.cos,
  math.sum,
  math.mean,
  math.max,
  math.relu,
  math.sigmoid,
  math.tanh,
  math.gelu,
  linalg.matmul,
  linalg.transpose,
  linalg.reshape,
  linalg.slice,
  linalg.concat,
  linalg.split,
  linalg.causalMask,
  loss.softmaxCrossEntropy,
  loss.argmax,
  loss.accuracy,
  loss.minimize,
  text.textData,
  text.embedding,
  text.sample,
  display.peek,
  display.scatter,
  display.image,
  structure.composite,
  structure.input,
  structure.output,
] as unknown as NodeDef<never>[];

export const registry: ReadonlyMap<string, NodeDef<Record<string, unknown>>> = new Map(
  ALL.map((d) => [d.type, d as unknown as NodeDef<Record<string, unknown>>]),
);

export const nodeDefs = [...registry.values()];

export function getDef(type: string): NodeDef<Record<string, unknown>> | undefined {
  return registry.get(type);
}

export type ParamsResult = { ok: true; params: Record<string, unknown> } | { ok: false; message: string };

/** Params with defaults filled in, or a readable reason they're invalid. */
export function parseParams(node: Pick<DocNode, 'type' | 'params'>): ParamsResult {
  const def = getDef(node.type);
  if (!def) return { ok: false, message: `Unknown node type "${node.type}"` };
  const r = def.params.safeParse(node.params ?? {});
  if (r.success) return { ok: true, params: r.data };
  const issue = r.error.issues[0];
  return { ok: false, message: `${issue.path.join('.') || 'params'}: ${issue.message}` };
}

export function defaultParams(type: string): Record<string, unknown> {
  const def = getDef(type);
  if (!def) throw new Error(`Unknown node type "${type}"`);
  return def.params.parse({});
}

export interface Ports {
  inputs: PortDef[];
  outputs: PortDef[];
}

/** Ports of a node; for groups they come from the Input/Output nodes inside. */
export function portsOf(doc: ProjectDoc, node: DocNode): Ports {
  if (node.type === 'composite') return compositePorts(doc, node.id);
  const def = getDef(node.type);
  if (!def) return { inputs: [], outputs: [] };
  const parsed = parseParams(node);
  const p = parsed.ok ? parsed.params : def.params.parse({});
  return {
    inputs: typeof def.inputs === 'function' ? def.inputs(p) : def.inputs,
    outputs: typeof def.outputs === 'function' ? def.outputs(p) : def.outputs,
  };
}

function boundary(doc: ProjectDoc, compositeId: string, type: 'input' | 'output'): { name: string; order: number }[] {
  return Object.values(doc.nodes)
    .filter((n) => n.parent === compositeId && n.type === type)
    .map((n) => {
      const parsed = parseParams(n);
      const p = (parsed.ok ? parsed.params : { name: '?', order: 0 }) as { name: string; order: number };
      return { name: p.name, order: p.order };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function compositePorts(doc: ProjectDoc, compositeId: string): Ports {
  return {
    inputs: boundary(doc, compositeId, 'input').map(({ name }) => ({ name })),
    outputs: boundary(doc, compositeId, 'output').map(({ name }) => ({ name })),
  };
}
