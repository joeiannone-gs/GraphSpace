/**
 * A small DSL for writing documents in code: lesson starters, gallery examples, built-in groups
 * and tests. Nodes without an explicit position are laid out automatically in layers.
 */
import { defaultParams } from '@/nodes/registry';
import { Subtree, cloneSubtree } from './clone';
import { newId } from './ids';
import { DocEdge, Id, ProjectDoc, Vec2, emptyDoc } from './types';

/** A node output: a bare id means its `out` port. */
export type Out = Id | [Id, string];

export interface AddOptions {
  label?: string;
  note?: string;
  pos?: Vec2;
}

export class DocBuilder {
  readonly doc: ProjectDoc;
  private scope: Id | null = null;
  private placed = new Set<Id>();
  private order: Id[] = [];

  constructor(doc: ProjectDoc = emptyDoc()) {
    this.doc = doc;
    // Nodes that already exist keep their positions.
    for (const id of Object.keys(doc.nodes)) this.placed.add(id);
  }

  /** Add nodes inside an existing group. */
  inGroup(group: Id, build: (b: DocBuilder) => void) {
    const outer = this.scope;
    this.scope = group;
    try {
      build(this);
    } finally {
      this.scope = outer;
    }
  }

  add(type: string, params: Record<string, unknown> = {}, opts: AddOptions = {}): Id {
    const id = newId();
    this.doc.nodes[id] = {
      id,
      type,
      parent: this.scope,
      pos: opts.pos ?? [0, 0],
      params: { ...defaultParams(type), ...params },
      ...(opts.label ? { label: opts.label } : {}),
      ...(opts.note ? { note: opts.note } : {}),
    };
    if (opts.pos) this.placed.add(id);
    this.order.push(id);
    return id;
  }

  wire(from: Out, to: Id, toPort: string, kind?: 'feedback'): Id {
    const [node, port] = typeof from === 'string' ? [from, 'out'] : from;
    const id = newId();
    const edge: DocEdge = { id, from: { node, port }, to: { node: to, port: toPort } };
    if (kind) edge.kind = kind;
    this.doc.edges[id] = edge;
    return id;
  }

  /** A group; nodes added inside `build` belong to it. */
  group(label: string, build: (b: DocBuilder) => void, opts: Omit<AddOptions, 'label'> & { source?: ProjectDoc['nodes'][string]['source'] } = {}): Id {
    const id = this.add('composite', {}, { ...opts, label });
    if (opts.source) this.doc.nodes[id].source = opts.source;
    const outer = this.scope;
    this.scope = id;
    try {
      build(this);
    } finally {
      this.scope = outer;
    }
    return id;
  }

  input(name: string, order = 0, opts: AddOptions = {}): Id {
    return this.add('input', { name, order }, { label: name, ...opts });
  }

  output(name: string, order = 0, opts: AddOptions = {}): Id {
    return this.add('output', { name, order }, { label: name, ...opts });
  }

  /** Copy a subtree (e.g. a built-in group) into the current scope. */
  insert(sub: Subtree, opts: AddOptions = {}): Id {
    const copy = cloneSubtree(sub, this.scope, opts.pos ?? [0, 0]);
    Object.assign(this.doc.nodes, copy.nodes);
    Object.assign(this.doc.edges, copy.edges);
    if (opts.label) this.doc.nodes[copy.root].label = opts.label;
    if (opts.pos) this.placed.add(copy.root);
    this.order.push(copy.root);
    for (const id of Object.keys(copy.nodes)) if (id !== copy.root) this.placed.add(id);
    return copy.root;
  }

  build(): ProjectDoc {
    autoLayout(this.doc, (id) => !this.placed.has(id), this.order);
    return this.doc;
  }
}

/** Radius a node is drawn with (groups grow with their contents); mirrors canvas/geometry. */
function layoutRadius(doc: ProjectDoc, id: Id, childCount: Map<Id, number>): number {
  const n = doc.nodes[id];
  if (n.type === 'composite') return 300 * Math.min(3.5, Math.max(1.25, 0.8 + 0.35 * Math.sqrt(childCount.get(id) ?? 0)));
  if (n.type === 'input' || n.type === 'output') return 165;
  return 300;
}

/**
 * Layered layout per scope: a node's layer is its longest distance from a source (feedback edges
 * ignored). Layers and siblings are spaced by the sizes of the nodes in them, so big groups don't
 * overlap and small nodes stay close. Direction `up` stacks layers bottom to top, `right` left to right.
 */
export function autoLayout(doc: ProjectDoc, shouldPlace: (id: Id) => boolean, order: Id[] = Object.keys(doc.nodes)) {
  const GAP = 260;
  const rank = new Map(order.map((id, i) => [id, i]));
  const scopes = new Map<Id | null, Id[]>();
  const childCount = new Map<Id, number>();
  for (const n of Object.values(doc.nodes)) {
    scopes.set(n.parent, [...(scopes.get(n.parent) ?? []), n.id]);
    if (n.parent) childCount.set(n.parent, (childCount.get(n.parent) ?? 0) + 1);
  }
  for (const [, ids] of scopes) {
    const inScope = new Set(ids);
    const preds = new Map<Id, Id[]>();
    for (const e of Object.values(doc.edges)) {
      if (e.kind === 'feedback' || !inScope.has(e.from.node) || !inScope.has(e.to.node)) continue;
      preds.set(e.to.node, [...(preds.get(e.to.node) ?? []), e.from.node]);
    }
    const layer = new Map<Id, number>();
    const visiting = new Set<Id>();
    const depth = (id: Id): number => {
      if (layer.has(id)) return layer.get(id)!;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const d = Math.max(-1, ...(preds.get(id) ?? []).map(depth)) + 1;
      visiting.delete(id);
      layer.set(id, d);
      return d;
    };
    ids.forEach(depth);
    const byLayer = new Map<number, Id[]>();
    for (const id of [...ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))) {
      const l = layer.get(id)!;
      byLayer.set(l, [...(byLayer.get(l) ?? []), id]);
    }
    const r = (id: Id) => layoutRadius(doc, id, childCount);
    let along = 0;
    let prevHalf = 0;
    for (const l of [...byLayer.keys()].sort((a, b) => a - b)) {
      const members = byLayer.get(l)!;
      const half = Math.max(...members.map(r));
      along += l === 0 ? 0 : prevHalf + GAP + half;
      prevHalf = half;
      const widths = members.map((id) => 2 * r(id) + GAP);
      let across = -widths.reduce((a, b) => a + b, 0) / 2;
      members.forEach((id, i) => {
        const center = across + widths[i] / 2;
        across += widths[i];
        if (!shouldPlace(id)) return;
        doc.nodes[id].pos = doc.layout.direction === 'up' ? [center || 0, -along || 0] : [along || 0, center || 0];
      });
    }
  }
}
