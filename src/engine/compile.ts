/**
 * Turns a project document into an executable plan: groups are flattened (their Input/Output
 * nodes are wired through), every primitive's inputs are resolved to the primitive that produces
 * them, and primitives are ordered so each runs after its inputs. Problems are reported per node.
 */
import type { DocEdge, DocNode, Id, PortRef, ProjectDoc } from '@/doc/types';
import { getDef, parseParams, portsOf } from '@/nodes/registry';
import type { NodeDef, PortDef } from '@/nodes/types';

export type NodeErrorCode =
  | 'unknown-type'
  | 'bad-params'
  | 'missing-input'
  | 'feedback-port'
  | 'cycle'
  | 'multiple-minimize'
  | 'runtime'
  | 'blocked';

export interface NodeError {
  code: NodeErrorCode;
  message: string;
}

/** Where a value comes from: a primitive node's output port. */
export interface Source {
  node: Id;
  port: string;
  /** Read from the previous iteration rather than the current one. */
  feedback: boolean;
}

export interface CompiledNode {
  id: Id;
  type: string;
  def: NodeDef<Record<string, unknown>>;
  params: Record<string, unknown>;
  inputPorts: PortDef[];
  inputs: Record<string, Source | undefined>;
}

export interface Compiled {
  /** Runnable primitives in dependency order. */
  order: CompiledNode[];
  /** Problems found before running; these nodes are not in `order`. */
  errors: Map<Id, NodeError>;
  minimize: Id | null;
  /** Values shown on groups and boundary nodes: `${node}:${port}` → the primitive output it mirrors. */
  aliases: Map<string, Source>;
  /** Primitive outputs that feed a feedback edge (kept between iterations). */
  feedbackSources: Set<string>;
}

export const portKey = (node: Id, port: string) => `${node}:${port}`;

const STRUCTURE = new Set(['composite', 'input', 'output']);

export function isPrimitive(node: DocNode): boolean {
  return !STRUCTURE.has(node.type);
}

export function compile(doc: ProjectDoc): Compiled {
  const errors = new Map<Id, NodeError>();
  const edgeInto = new Map<string, DocEdge>();
  for (const e of Object.values(doc.edges)) edgeInto.set(portKey(e.to.node, e.to.port), e);

  const boundaryByName = (compositeId: Id, type: 'input' | 'output', name: string): DocNode | undefined =>
    Object.values(doc.nodes).find((n) => {
      if (n.parent !== compositeId || n.type !== type) return false;
      const p = parseParams(n);
      return p.ok && p.params.name === name;
    });

  /** Follow an edge's source through groups to the primitive that produces it. */
  const resolve = (from: PortRef, feedback: boolean, depth = 0): Source | undefined => {
    if (depth > 500) return undefined;
    const node = doc.nodes[from.node];
    if (!node) return undefined;
    if (node.type === 'composite') {
      const out = boundaryByName(node.id, 'output', from.port);
      const e = out && edgeInto.get(portKey(out.id, 'in'));
      return e ? resolve(e.from, feedback || e.kind === 'feedback', depth + 1) : undefined;
    }
    if (node.type === 'input') {
      if (node.parent === null) return undefined;
      const p = parseParams(node);
      if (!p.ok) return undefined;
      const e = edgeInto.get(portKey(node.parent, String(p.params.name)));
      return e ? resolve(e.from, feedback || e.kind === 'feedback', depth + 1) : undefined;
    }
    if (node.type === 'output') return undefined;
    return { node: node.id, port: from.port, feedback };
  };

  const compiled: CompiledNode[] = [];
  let minimize: Id | null = null;
  const minimizers = Object.values(doc.nodes).filter((n) => n.type === 'minimize');
  if (minimizers.length > 1) {
    for (const m of minimizers) {
      errors.set(m.id, { code: 'multiple-minimize', message: 'Only one Minimize node is allowed in a project.' });
    }
  } else if (minimizers.length === 1) {
    minimize = minimizers[0].id;
  }

  for (const node of Object.values(doc.nodes)) {
    if (!isPrimitive(node) || errors.has(node.id)) continue;
    const def = getDef(node.type);
    if (!def) {
      errors.set(node.id, { code: 'unknown-type', message: `Unknown node type "${node.type}".` });
      continue;
    }
    const parsed = parseParams(node);
    if (!parsed.ok) {
      errors.set(node.id, { code: 'bad-params', message: parsed.message });
      continue;
    }
    const { inputs: inputPorts } = portsOf(doc, node);
    const inputs: Record<string, Source | undefined> = {};
    let problem: NodeError | null = null;
    for (const port of inputPorts) {
      const e = edgeInto.get(portKey(node.id, port.name));
      if (e?.kind === 'feedback' && !port.feedback) {
        problem = { code: 'feedback-port', message: `Input "${port.name}" can't take a feedback (previous-step) connection.` };
        break;
      }
      const src = e ? resolve(e.from, e.kind === 'feedback') : undefined;
      if (!src && !port.optional && !port.feedback) {
        problem = { code: 'missing-input', message: `Connect something to “${port.label ?? port.name}”.` };
        break;
      }
      inputs[port.name] = src;
    }
    if (problem) {
      errors.set(node.id, problem);
      continue;
    }
    compiled.push({ id: node.id, type: node.type, def, params: parsed.params, inputPorts, inputs });
  }

  // Kahn's algorithm over same-iteration dependencies.
  const byId = new Map(compiled.map((c) => [c.id, c]));
  const indegree = new Map<Id, number>();
  const dependents = new Map<Id, Id[]>();
  for (const c of compiled) {
    const deps = new Set<Id>();
    for (const src of Object.values(c.inputs)) {
      if (src && !src.feedback && byId.has(src.node)) deps.add(src.node);
    }
    indegree.set(c.id, deps.size);
    for (const d of deps) dependents.set(d, [...(dependents.get(d) ?? []), c.id]);
  }
  const ready = compiled.filter((c) => indegree.get(c.id) === 0).map((c) => c.id);
  const order: CompiledNode[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    order.push(byId.get(id)!);
    for (const next of dependents.get(id) ?? []) {
      const d = indegree.get(next)! - 1;
      indegree.set(next, d);
      if (d === 0) ready.push(next);
    }
  }
  if (order.length < compiled.length) {
    const placed = new Set(order.map((c) => c.id));
    for (const c of compiled) {
      if (!placed.has(c.id)) {
        errors.set(c.id, {
          code: 'cycle',
          message: 'This node is part of a loop. Loops need a feedback connection (a value from the previous step).',
        });
      }
    }
  }

  const aliases = new Map<string, Source>();
  const feedbackSources = new Set<string>();
  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'composite') {
      for (const port of portsOf(doc, node).outputs) {
        const src = resolve({ node: node.id, port: port.name }, false);
        if (src) aliases.set(portKey(node.id, port.name), src);
      }
    } else if (node.type === 'input') {
      const src = resolve({ node: node.id, port: 'out' }, false);
      if (src) aliases.set(portKey(node.id, 'out'), src);
    } else if (node.type === 'output') {
      const e = edgeInto.get(portKey(node.id, 'in'));
      const src = e && resolve(e.from, e.kind === 'feedback');
      if (src) aliases.set(portKey(node.id, 'in'), src);
    }
  }
  for (const c of order) {
    for (const src of Object.values(c.inputs)) {
      if (src?.feedback) feedbackSources.add(portKey(src.node, src.port));
    }
  }

  return { order, errors, minimize: errors.has(minimize ?? '') ? null : minimize, aliases, feedbackSources };
}
