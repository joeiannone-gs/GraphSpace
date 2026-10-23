/** Questions lesson checks ask about a learner's graph ("is there a ReLU fed by a Linear layer?"). */
import { makeResolver } from '@/engine/compile';
import type { DocNode, Id, ProjectDoc } from '@/doc/types';
import { portsOf } from '@/nodes/registry';

export type NodeMatch = string | ((n: DocNode) => boolean);

export class GraphQuery {
  private readonly resolver: ReturnType<typeof makeResolver>;
  constructor(readonly doc: ProjectDoc) {
    this.resolver = makeResolver(doc);
  }

  private matches(n: DocNode, m: NodeMatch): boolean {
    return typeof m === 'string' ? n.type === m || (n.type === 'composite' && n.source?.id === m) : m(n);
  }

  /** Nodes of a type (or built-in group id, or predicate), at any depth. */
  nodes(m: NodeMatch): DocNode[] {
    return Object.values(this.doc.nodes).filter((n) => this.matches(n, m));
  }

  has(m: NodeMatch, atLeast = 1): boolean {
    return this.nodes(m).length >= atLeast;
  }

  /** The primitive node feeding `node.port` (through groups), if connected. */
  source(node: Id, port: string): DocNode | undefined {
    const s = this.resolver.sourceOf(node, port);
    return s ? this.doc.nodes[s.node] : undefined;
  }

  /** Every primitive node upstream of `node` (following resolved connections). */
  upstream(node: Id): Set<Id> {
    const seen = new Set<Id>();
    const stack = [node];
    while (stack.length) {
      const id = stack.pop()!;
      const n = this.doc.nodes[id];
      if (!n) continue;
      for (const p of portsOf(this.doc, n).inputs) {
        const s = this.resolver.sourceOf(id, p.name);
        if (s && !seen.has(s.node)) {
          seen.add(s.node);
          stack.push(s.node);
        }
      }
    }
    return seen;
  }

  /** Is some node matching `from` upstream of some node matching `to`? */
  flows(from: NodeMatch, to: NodeMatch): boolean {
    const targets = this.nodes(to);
    const sources = new Set(this.nodes(from).map((n) => n.id));
    // Groups count through their insides: a group "feeds" if any primitive inside it does.
    for (const g of this.nodes(from).filter((n) => n.type === 'composite')) {
      for (const n of Object.values(this.doc.nodes)) if (this.inside(n.id, g.id)) sources.add(n.id);
    }
    return targets.some((t) => {
      const up = this.upstream(t.id);
      if (t.type === 'composite') {
        for (const n of Object.values(this.doc.nodes)) if (this.inside(n.id, t.id)) for (const u of this.upstream(n.id)) up.add(u);
      }
      return [...up].some((u) => sources.has(u));
    });
  }

  /** Is `node` somewhere inside group `group`? */
  inside(node: Id, group: Id): boolean {
    for (let p = this.doc.nodes[node]?.parent ?? null; p !== null; p = this.doc.nodes[p]?.parent ?? null) if (p === group) return true;
    return false;
  }
}
