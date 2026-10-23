import { describe, expect, it } from 'vitest';
import { DocBuilder } from '@/doc/builder';
import { diffDocs, isEmptyDiff } from '@/doc/diff';
import { migrate } from '@/doc/migrate';
import { checkDocIntegrity } from '@/doc/schema';
import type { ProjectDoc } from '@/doc/types';
import { Session } from '@/engine/session';
import { toNested } from '@/engine/tensor';
import { connect, connectProblem, groupNodes, removeNodes, setParams, ungroup } from './ops';

const noFetch = async () => new ArrayBuffer(0);

async function valueOf(doc: ProjectDoc, node: string) {
  const s = new Session(noFetch);
  await s.load(doc);
  s.evaluate();
  expect([...s.errors.values()]).toEqual([]);
  return toNested(s.valueOf(node)!);
}

/** (a + b) * b, squared — enough structure to test grouping across boundaries. */
function sample() {
  const b = new DocBuilder();
  const a = b.add('value', { value: { shape: [2], data: [1, 2] } });
  const c = b.add('value', { value: { shape: [2], data: [3, 4] } });
  const sum = b.add('add');
  b.wire(a, sum, 'a');
  b.wire(c, sum, 'b');
  const prod = b.add('multiply');
  b.wire(sum, prod, 'a');
  b.wire(c, prod, 'b');
  const sq = b.add('square');
  b.wire(prod, sq, 'x');
  return { doc: b.build(), a, c, sum, prod, sq };
}

describe('graph ops', () => {
  it('group and ungroup keep the computation the same', async () => {
    const { doc, sum, prod, sq } = sample();
    const expected = await valueOf(doc, sq);
    expect(expected).toEqual([144, 576]);

    const grouped = structuredClone(doc);
    expect(groupNodes(grouped, [sum, prod], 'G1', 'Inner')).toBeNull();
    expect(checkDocIntegrity(grouped)).toEqual([]);
    const boundary = Object.values(grouped.nodes).filter((n) => n.parent === 'G1' && n.type !== 'add' && n.type !== 'multiply');
    // two distinct outside sources (a, c) → two inputs; one outside consumer → one output
    expect(boundary.filter((n) => n.type === 'input')).toHaveLength(2);
    expect(boundary.filter((n) => n.type === 'output')).toHaveLength(1);
    expect(await valueOf(grouped, sq)).toEqual(expected);

    const flat = structuredClone(grouped);
    expect(ungroup(flat, 'G1')).toBeNull();
    expect(checkDocIntegrity(flat)).toEqual([]);
    expect(Object.values(flat.nodes).some((n) => n.type === 'composite' || n.type === 'input' || n.type === 'output')).toBe(false);
    expect(await valueOf(flat, sq)).toEqual(expected);
  });

  it('connect replaces the existing edge into a port and refuses cross-scope edges', () => {
    const { doc, a, sum, prod } = sample();
    const before = Object.keys(doc.edges).length;
    expect(connect(doc, { id: 'e1', from: { node: a, port: 'out' }, to: { node: sum, port: 'b' } })).toBeNull();
    expect(Object.keys(doc.edges)).toHaveLength(before);
    expect(Object.values(doc.edges).filter((e) => e.to.node === sum && e.to.port === 'b')[0].from.node).toBe(a);

    groupNodes(doc, [prod], 'G');
    expect(connectProblem(doc, { node: a, port: 'out' }, { node: prod, port: 'a' })).toMatch(/same group/);
    expect(connectProblem(doc, { node: a, port: 'nope' }, { node: sum, port: 'a' })).toMatch(/No output/);
    expect(connectProblem(doc, { node: sum, port: 'out' }, { node: sum, port: 'a' })).toMatch(/feed itself/);
  });

  it('removing a group removes its contents and all touching edges', () => {
    const { doc, sum, prod } = sample();
    groupNodes(doc, [sum, prod], 'G');
    removeNodes(doc, ['G']);
    expect(checkDocIntegrity(doc)).toEqual([]);
    expect(doc.nodes[sum]).toBeUndefined();
    expect(Object.values(doc.edges).some((e) => e.to.node === 'G' || e.from.node === 'G')).toBe(false);
  });

  it('changing a param that removes ports drops their edges', () => {
    const b = new DocBuilder();
    const v = b.add('value');
    const cat = b.add('concat', { count: 3 });
    for (const port of ['in0', 'in1', 'in2']) b.wire(v, cat, port);
    const doc = b.build();
    setParams(doc, cat, { count: 2 });
    expect(Object.values(doc.edges).map((e) => e.to.port).sort()).toEqual(['in0', 'in1']);
  });
});

describe('diff and migrate', () => {
  it('reports added, removed and changed nodes and edges', () => {
    const { doc, a, sq } = sample();
    const after = structuredClone(doc);
    setParams(after, a, { value: { shape: [2], data: [9, 9] } });
    removeNodes(after, [sq]);
    after.nodes[a].pos = [5, 5];
    const d = diffDocs(doc, after);
    expect(d.nodes.removed).toEqual([sq]);
    expect(d.nodes.changed).toEqual([{ id: a, fields: ['params', 'pos'] }]);
    expect(d.edges.removed).toHaveLength(1);
    expect(isEmptyDiff(diffDocs(doc, structuredClone(doc)))).toBe(true);
  });

  it('migrate accepts current documents and rejects newer ones', () => {
    const { doc } = sample();
    expect(migrate(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(() => migrate({ ...doc, schemaVersion: 99 })).toThrow(/newer version/);
  });
});
