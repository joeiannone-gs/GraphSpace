/**
 * Pure edits on a project document. Each mutates the document it is given (an Immer draft in the
 * store, a plain clone in tests) and keeps the document's invariants:
 * - edges connect nodes in the same scope (same parent),
 * - an input port has at most one incoming edge,
 * - removing a node removes everything inside it and every edge touching it.
 */
import { Subtree, descendants } from '@/doc/clone';
import { newId as defaultNewId } from '@/doc/ids';
import type { DocEdge, DocNode, Id, PortRef, ProjectDoc, Vec2 } from '@/doc/types';
import { defaultParams, getDef, portsOf } from '@/nodes/registry';

type NewId = () => string;

export function addNode(
  doc: ProjectDoc,
  n: { id: Id; type: string; parent: Id | null; pos: Vec2; params?: Record<string, unknown>; label?: string },
) {
  if (!getDef(n.type)) throw new Error(`Unknown node type "${n.type}"`);
  if (n.parent !== null && doc.nodes[n.parent]?.type !== 'composite') throw new Error('Parent must be a group');
  const node: DocNode = {
    id: n.id,
    type: n.type,
    parent: n.parent,
    pos: n.pos,
    params: { ...defaultParams(n.type), ...(n.params ?? {}) },
  };
  if (n.label) node.label = n.label;
  doc.nodes[n.id] = node;
}

/** Insert an already re-identified subtree (see cloneSubtree). */
export function addSubtree(doc: ProjectDoc, sub: Subtree) {
  Object.assign(doc.nodes, structuredClone(sub.nodes));
  Object.assign(doc.edges, structuredClone(sub.edges));
}

export function removeNodes(doc: ProjectDoc, ids: Id[]) {
  const doomed = new Set<Id>();
  for (const id of ids) {
    if (!doc.nodes[id]) continue;
    doomed.add(id);
    for (const d of descendants(doc, id)) doomed.add(d);
  }
  for (const id of doomed) delete doc.nodes[id];
  for (const e of Object.values(doc.edges)) {
    if (doomed.has(e.from.node) || doomed.has(e.to.node)) delete doc.edges[e.id];
  }
}

export function moveNodes(doc: ProjectDoc, moves: { id: Id; pos: Vec2 }[]) {
  for (const { id, pos } of moves) {
    const n = doc.nodes[id];
    if (n) n.pos = pos;
  }
}

/** Why `from` → `to` can't be connected, or null if it can. */
export function connectProblem(doc: ProjectDoc, from: PortRef, to: PortRef, kind?: 'feedback'): string | null {
  const a = doc.nodes[from.node];
  const b = doc.nodes[to.node];
  if (!a || !b) return 'Node not found';
  if (a.parent !== b.parent) return 'Both nodes must be in the same group';
  if (!portsOf(doc, a).outputs.some((p) => p.name === from.port)) return `No output named "${from.port}"`;
  const target = portsOf(doc, b).inputs.find((p) => p.name === to.port);
  if (!target) return `No input named "${to.port}"`;
  if (kind === 'feedback' && !target.feedback) return `Input "${to.port}" can't take a feedback connection`;
  if (a.id === b.id && kind !== 'feedback') return "A node can't feed itself (use a feedback connection)";
  return null;
}

/** Connect, replacing whatever was plugged into the target port. Returns an error message if invalid. */
export function connect(doc: ProjectDoc, e: { id: Id; from: PortRef; to: PortRef; kind?: 'feedback' }): string | null {
  const problem = connectProblem(doc, e.from, e.to, e.kind);
  if (problem) return problem;
  for (const old of Object.values(doc.edges)) {
    if (old.to.node === e.to.node && old.to.port === e.to.port) delete doc.edges[old.id];
  }
  const edge: DocEdge = { id: e.id, from: { ...e.from }, to: { ...e.to } };
  if (e.kind) edge.kind = e.kind;
  doc.edges[e.id] = edge;
  return null;
}

export function disconnect(doc: ProjectDoc, edgeIds: Id[]) {
  for (const id of edgeIds) delete doc.edges[id];
}

export function setParams(doc: ProjectDoc, id: Id, patch: Record<string, unknown>) {
  const n = doc.nodes[id];
  if (!n) return;
  n.params = { ...n.params, ...patch };
  pruneDanglingEdges(doc, id);
}

/** After a param change that removes ports (e.g. fewer Concat inputs), drop edges to ports that are gone. */
function pruneDanglingEdges(doc: ProjectDoc, id: Id) {
  const n = doc.nodes[id];
  const { inputs, outputs } = portsOf(doc, n);
  const ins = new Set(inputs.map((p) => p.name));
  const outs = new Set(outputs.map((p) => p.name));
  for (const e of Object.values(doc.edges)) {
    if ((e.to.node === id && !ins.has(e.to.port)) || (e.from.node === id && !outs.has(e.from.port))) {
      delete doc.edges[e.id];
    }
  }
  // Renaming a group's Input/Output changes the group's ports.
  if ((n.type === 'input' || n.type === 'output') && n.parent) pruneDanglingEdges(doc, n.parent);
}

export function setLabel(doc: ProjectDoc, id: Id, label: string) {
  const n = doc.nodes[id];
  if (!n) return;
  if (label.trim()) n.label = label.trim();
  else delete n.label;
}

export function setNote(doc: ProjectDoc, id: Id, note: string) {
  const n = doc.nodes[id];
  if (!n) return;
  if (note.trim()) n.note = note;
  else delete n.note;
}

function uniqueName(base: string, taken: Set<string>): string {
  const clean = base.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([^A-Za-z_])/, '_$1') || 'x';
  let name = clean;
  for (let i = 2; taken.has(name); i++) name = `${clean}${i}`;
  taken.add(name);
  return name;
}

/**
 * Wrap sibling nodes in a new group. Edges that cross the group's boundary are rerouted through
 * new Input/Output nodes, so the computation is unchanged.
 */
export function groupNodes(doc: ProjectDoc, ids: Id[], groupId: Id, label = 'Group', newId: NewId = defaultNewId): string | null {
  const members = ids.map((id) => doc.nodes[id]).filter(Boolean);
  if (members.length === 0) return 'Select some nodes to group';
  const parent = members[0].parent;
  if (members.some((m) => m.parent !== parent)) return 'Grouped nodes must be in the same group';
  const inside = new Set(members.map((m) => m.id));

  const cx = members.reduce((s, m) => s + m.pos[0], 0) / members.length;
  const cy = members.reduce((s, m) => s + m.pos[1], 0) / members.length;
  doc.nodes[groupId] = { id: groupId, type: 'composite', parent, pos: [cx, cy], label, params: {} };
  for (const m of members) {
    m.parent = groupId;
    m.pos = [m.pos[0] - cx, m.pos[1] - cy];
  }

  const ys = members.map((m) => m.pos[1]);
  const up = doc.layout.direction === 'up';
  const inEdge = up ? Math.max(...ys) + 900 : Math.min(...members.map((m) => m.pos[0])) - 900;
  const outEdge = up ? Math.min(...ys) - 900 : Math.max(...members.map((m) => m.pos[0])) + 900;
  const place = (i: number, n: number, edge: number): Vec2 => {
    const across = (i - (n - 1) / 2) * 900;
    return up ? [across, edge] : [edge, across];
  };

  const names = new Set<string>();
  const incoming = Object.values(doc.edges).filter((e) => !inside.has(e.from.node) && inside.has(e.to.node));
  const outgoing = Object.values(doc.edges).filter((e) => inside.has(e.from.node) && !inside.has(e.to.node));

  const inputBySource = new Map<string, Id>();
  const inSources = [...new Set(incoming.map((e) => `${e.from.node}:${e.from.port}`))];
  inSources.forEach((key, i) => {
    const sample = incoming.find((e) => `${e.from.node}:${e.from.port}` === key)!;
    const name = uniqueName(sample.to.port, names);
    const inputId = newId();
    doc.nodes[inputId] = {
      id: inputId,
      type: 'input',
      parent: groupId,
      pos: place(i, inSources.length, inEdge),
      label: name,
      params: { name, order: i },
    };
    inputBySource.set(key, inputId);
    const outer = newId();
    doc.edges[outer] = { id: outer, from: { ...sample.from }, to: { node: groupId, port: name } };
  });
  for (const e of incoming) {
    e.from = { node: inputBySource.get(`${e.from.node}:${e.from.port}`)!, port: 'out' };
  }

  const outSources = [...new Set(outgoing.map((e) => `${e.from.node}:${e.from.port}`))];
  outSources.forEach((key, i) => {
    const sample = outgoing.find((e) => `${e.from.node}:${e.from.port}` === key)!;
    const name = uniqueName(sample.from.port === 'out' ? 'y' : sample.from.port, names);
    const outputId = newId();
    doc.nodes[outputId] = {
      id: outputId,
      type: 'output',
      parent: groupId,
      pos: place(i, outSources.length, outEdge),
      label: name,
      params: { name, order: i },
    };
    const innerEdge = newId();
    doc.edges[innerEdge] = { id: innerEdge, from: { ...sample.from }, to: { node: outputId, port: 'in' } };
    for (const e of outgoing.filter((o) => `${o.from.node}:${o.from.port}` === key)) {
      e.from = { node: groupId, port: name };
    }
  });
  return null;
}

/** Dissolve a group: its contents move up one level and boundary nodes are wired through. */
export function ungroup(doc: ProjectDoc, groupId: Id, newId: NewId = defaultNewId): string | null {
  const group = doc.nodes[groupId];
  if (!group || group.type !== 'composite') return 'Not a group';
  const children = Object.values(doc.nodes).filter((n) => n.parent === groupId);
  const edges = Object.values(doc.edges);
  const nameOf = (n: DocNode) => String(n.params.name);

  for (const inp of children.filter((n) => n.type === 'input')) {
    const feeding = edges.find((e) => e.to.node === groupId && e.to.port === nameOf(inp));
    for (const e of edges.filter((x) => x.from.node === inp.id)) {
      delete doc.edges[e.id];
      if (feeding) {
        const id = newId();
        doc.edges[id] = { id, from: { ...feeding.from }, to: { ...e.to }, ...(feeding.kind || e.kind ? { kind: 'feedback' as const } : {}) };
      }
    }
  }
  for (const outp of children.filter((n) => n.type === 'output')) {
    const inner = edges.find((e) => e.to.node === outp.id);
    for (const e of edges.filter((x) => x.from.node === groupId && x.from.port === nameOf(outp))) {
      delete doc.edges[e.id];
      if (inner) {
        const id = newId();
        doc.edges[id] = { id, from: { ...inner.from }, to: { ...e.to }, ...(inner.kind || e.kind ? { kind: 'feedback' as const } : {}) };
      }
    }
  }
  for (const c of children) {
    if (c.type === 'input' || c.type === 'output') continue;
    c.parent = group.parent;
    c.pos = [group.pos[0] + c.pos[0], group.pos[1] + c.pos[1]];
  }
  // Removes the group, its boundary nodes and every edge still touching them.
  removeNodes(doc, [groupId]);
  return null;
}

export function setTraining(doc: ProjectDoc, patch: Partial<ProjectDoc['training']>) {
  doc.training = { ...doc.training, ...patch };
}

export function setDescription(doc: ProjectDoc, description: string) {
  doc.info.description = description;
}

export function setDirection(doc: ProjectDoc, direction: ProjectDoc['layout']['direction']) {
  doc.layout.direction = direction;
}

/** Nodes directly inside a scope (null = top level). */
export function childrenOf(doc: ProjectDoc, parent: Id | null): DocNode[] {
  return Object.values(doc.nodes).filter((n) => n.parent === parent);
}
