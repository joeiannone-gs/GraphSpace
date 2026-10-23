/** What changed between two versions of a document (for the commit diff view). */
import type { DocNode, Id, ProjectDoc } from './types';

export type NodeChange = 'type' | 'params' | 'parent' | 'label' | 'note' | 'pos';

export interface DocDiff {
  nodes: { added: Id[]; removed: Id[]; changed: { id: Id; fields: NodeChange[] }[] };
  edges: { added: Id[]; removed: Id[] };
  training: boolean;
  description: boolean;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function nodeChanges(a: DocNode, b: DocNode): NodeChange[] {
  const fields: NodeChange[] = [];
  if (a.type !== b.type) fields.push('type');
  if (!same(a.params, b.params)) fields.push('params');
  if (a.parent !== b.parent) fields.push('parent');
  if ((a.label ?? '') !== (b.label ?? '')) fields.push('label');
  if ((a.note ?? '') !== (b.note ?? '')) fields.push('note');
  if (a.pos[0] !== b.pos[0] || a.pos[1] !== b.pos[1]) fields.push('pos');
  return fields;
}

const edgeKey = (e: ProjectDoc['edges'][string]) => `${e.from.node}:${e.from.port}>${e.to.node}:${e.to.port}:${e.kind ?? ''}`;

export function diffDocs(before: ProjectDoc, after: ProjectDoc): DocDiff {
  const added = Object.keys(after.nodes).filter((id) => !before.nodes[id]);
  const removed = Object.keys(before.nodes).filter((id) => !after.nodes[id]);
  const changed = Object.keys(after.nodes)
    .filter((id) => before.nodes[id])
    .map((id) => ({ id, fields: nodeChanges(before.nodes[id], after.nodes[id]) }))
    .filter((c) => c.fields.length > 0);
  // Edges are compared by what they connect, not by id.
  const beforeEdges = new Map(Object.values(before.edges).map((e) => [edgeKey(e), e.id]));
  const afterEdges = new Map(Object.values(after.edges).map((e) => [edgeKey(e), e.id]));
  return {
    nodes: { added, removed, changed },
    edges: {
      added: [...afterEdges].filter(([k]) => !beforeEdges.has(k)).map(([, id]) => id),
      removed: [...beforeEdges].filter(([k]) => !afterEdges.has(k)).map(([, id]) => id),
    },
    training: !same(before.training, after.training),
    description: before.info.description !== after.info.description,
  };
}

export function isEmptyDiff(d: DocDiff): boolean {
  return (
    !d.nodes.added.length &&
    !d.nodes.removed.length &&
    !d.nodes.changed.length &&
    !d.edges.added.length &&
    !d.edges.removed.length &&
    !d.training &&
    !d.description
  );
}
