/** Copying parts of documents with fresh ids (inserting library nodes, paste, group templates). */
import { newId } from './ids';
import type { DocEdge, DocNode, Id, ProjectDoc, Vec2 } from './types';

/** A group node together with everything inside it and the edges between those nodes. */
export interface Subtree {
  root: Id;
  nodes: Record<Id, DocNode>;
  edges: Record<Id, DocEdge>;
}

export function descendants(doc: Pick<ProjectDoc, 'nodes'>, rootId: Id): Set<Id> {
  const children = new Map<Id, Id[]>();
  for (const n of Object.values(doc.nodes)) {
    if (n.parent !== null) children.set(n.parent, [...(children.get(n.parent) ?? []), n.id]);
  }
  const out = new Set<Id>();
  const stack = [...(children.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

export function extractSubtree(doc: ProjectDoc, rootId: Id): Subtree {
  const ids = descendants(doc, rootId);
  ids.add(rootId);
  const nodes: Record<Id, DocNode> = {};
  for (const id of ids) nodes[id] = structuredClone(doc.nodes[id]);
  nodes[rootId] = { ...nodes[rootId], parent: null };
  const edges: Record<Id, DocEdge> = {};
  for (const e of Object.values(doc.edges)) {
    if (ids.has(e.from.node) && ids.has(e.to.node) && e.from.node !== rootId && e.to.node !== rootId) {
      edges[e.id] = structuredClone(e);
    }
  }
  return { root: rootId, nodes, edges };
}

/** Copy of a subtree with fresh ids, its root placed under `parent` at `pos`. */
export function cloneSubtree(sub: Subtree, parent: Id | null, pos: Vec2): Subtree {
  const map = new Map<Id, Id>();
  for (const id of Object.keys(sub.nodes)) map.set(id, newId());
  const nodes: Record<Id, DocNode> = {};
  for (const n of Object.values(sub.nodes)) {
    const id = map.get(n.id)!;
    const isRoot = n.id === sub.root;
    nodes[id] = {
      ...structuredClone(n),
      id,
      parent: isRoot ? parent : map.get(n.parent!)!,
      pos: isRoot ? pos : n.pos,
    };
  }
  const edges: Record<Id, DocEdge> = {};
  for (const e of Object.values(sub.edges)) {
    const id = newId();
    edges[id] = {
      ...structuredClone(e),
      id,
      from: { node: map.get(e.from.node)!, port: e.from.port },
      to: { node: map.get(e.to.node)!, port: e.to.port },
    };
  }
  return { root: map.get(sub.root)!, nodes, edges };
}
