import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DocBuilder } from '@/doc/builder';
import { parseDoc } from '@/doc/schema';
import { builtinGroups, crossEntropy, linear, mlp, mse, softmax } from '@/library/builtin';
import { compile } from './compile';
import { Session } from './session';
import { toNested } from './tensor';

const fetchBytes = async (path: string) => {
  const buf = await readFile(`public${path}`);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

async function trained(doc: ReturnType<DocBuilder['build']>, steps: number) {
  const s = new Session(fetchBytes);
  await s.load(parseDoc(doc));
  for (let i = 0; i < steps; i++) s.trainStep();
  s.evaluate();
  return s;
}

describe('training converges', () => {
  it('fits a line to the 2-D points', async () => {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.05 };
    const data = b.add('dataset', { source: 'points-2d' });
    const w = b.add('parameter', { shape: [1, 1] }, { label: 'w' });
    const bias = b.add('parameter', { shape: [1], init: 'zeros' }, { label: 'b' });
    const mm = b.add('matmul');
    b.wire([data, 'x'], mm, 'a');
    b.wire(w, mm, 'b');
    const pred = b.add('add');
    b.wire(mm, pred, 'a');
    b.wire(bias, pred, 'b');
    const loss = b.insert(mse.build({}));
    b.wire(pred, loss, 'prediction');
    b.wire([data, 'y'], loss, 'target');
    const min = b.add('minimize');
    b.wire([loss, 'loss'], min, 'loss');

    const s = await trained(b.build(), 300);
    expect(s.currentLoss!).toBeLessThan(0.15);
    expect(s.valueOf(w)!.data[0]).toBeCloseTo(0.7, 1);
    expect(s.lossHistory[0]).toBeGreaterThan(s.lossHistory[s.lossHistory.length - 1]);
  });

  it('solves XOR with an MLP', async () => {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.05 };
    const data = b.add('dataset', { source: 'xor' });
    const net = b.insert(mlp.build({ inFeatures: 2, hidden: 16, outFeatures: 2 }));
    b.wire([data, 'x'], net, 'x');
    const ce = b.add('softmax_cross_entropy');
    b.wire([net, 'y'], ce, 'logits');
    b.wire([data, 'y'], ce, 'targets');
    const acc = b.add('accuracy');
    b.wire([net, 'y'], acc, 'scores');
    b.wire([data, 'y'], acc, 'targets');
    const min = b.add('minimize');
    b.wire(ce, min, 'loss');

    const s = await trained(b.build(), 400);
    expect(s.valueOf(acc)!.data[0]).toBe(1);
    expect(s.currentLoss!).toBeLessThan(0.1);
  });

  it('classifies MNIST digits above 85% on the training set', async () => {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.01 };
    const data = b.add('dataset', { source: 'mnist-200' });
    const layer = b.insert(linear.build({ inFeatures: 784, outFeatures: 10 }));
    b.wire([data, 'x'], layer, 'x');
    const ce = b.add('softmax_cross_entropy');
    b.wire([layer, 'y'], ce, 'logits');
    b.wire([data, 'y'], ce, 'targets');
    const acc = b.add('accuracy');
    b.wire([layer, 'y'], acc, 'scores');
    b.wire([data, 'y'], acc, 'targets');
    const min = b.add('minimize');
    b.wire(ce, min, 'loss');

    const started = performance.now();
    const s = await trained(b.build(), 60);
    expect(performance.now() - started).toBeLessThan(20_000);
    expect(s.valueOf(acc)!.data[0]).toBeGreaterThan(0.85);
  });
});

describe('built-in groups', () => {
  it('cross-entropy group matches the fused primitive, and softmax rows sum to 1', async () => {
    const b = new DocBuilder();
    const logits = b.add('value', { value: { shape: [2, 3], data: [1, 2, 3, -1, 0, 4] } });
    const targets = b.add('value', { value: { shape: [2, 3], data: [0, 0, 1, 1, 0, 0] } });
    const group = b.insert(crossEntropy.build({}));
    b.wire(logits, group, 'logits');
    b.wire(targets, group, 'targets');
    const fused = b.add('softmax_cross_entropy');
    b.wire(logits, fused, 'logits');
    b.wire(targets, fused, 'targets');
    const sm = b.insert(softmax.build({}));
    b.wire(logits, sm, 'x');
    const peek = b.add('peek');
    b.wire([sm, 'out'], peek, 'x');
    const doc = b.build();

    const s = new Session(fetchBytes);
    await s.load(doc);
    s.evaluate();
    const snap = s.snapshot();
    const groupLoss = snap.tensors[snap.nodes[group].outputs.loss].data[0];
    expect(groupLoss).toBeCloseTo(s.valueOf(fused)!.data[0], 10);
    const rows = toNested(s.valueOf(peek)!) as number[][];
    for (const row of rows) expect(row.reduce((x, y) => x + y)).toBeCloseTo(1, 10);
  });

  it('every built-in group compiles cleanly when its inputs are connected', () => {
    for (const g of builtinGroups) {
      const b = new DocBuilder();
      const sub = g.build(g.defaults);
      const root = b.insert(sub);
      const inputs = Object.values(sub.nodes).filter((n) => n.type === 'input' && n.parent === sub.root);
      for (const inp of inputs) {
        const v = b.add('value', { value: { shape: [2, 2], data: [1, 2, 3, 4] } });
        b.wire(v, root, String(inp.params.name));
      }
      const c = compile(b.build());
      expect([...c.errors.values()], g.id).toEqual([]);
    }
  });
});

describe('compile and run errors', () => {
  it('reports missing inputs, loops without feedback, and blocks downstream nodes', async () => {
    const b = new DocBuilder();
    const lonely = b.add('add');
    const v = b.add('value', { value: { shape: [2], data: [1, 2] } });
    const loopA = b.add('add');
    const loopB = b.add('negate');
    b.wire(v, loopA, 'a');
    b.wire(loopB, loopA, 'b');
    b.wire(loopA, loopB, 'x');
    const bad = b.add('matmul');
    const m = b.add('value', { value: { shape: [3, 3], data: [1, 0, 0, 0, 1, 0, 0, 0, 1] } });
    b.wire(v, bad, 'a');
    b.wire(m, bad, 'b');
    const after = b.add('square');
    b.wire(bad, after, 'x');
    const doc = b.build();

    const s = new Session(fetchBytes);
    await s.load(doc);
    s.evaluate();
    expect(s.errors.get(lonely)?.code).toBe('missing-input');
    expect(s.errors.get(loopA)?.code).toBe('cycle');
    expect(s.errors.get(loopB)?.code).toBe('cycle');
    expect(s.errors.get(bad)?.code).toBe('runtime');
    expect(s.errors.get(bad)?.message).toMatch(/MatMul: a is \[1, 2\]/);
    expect(s.errors.get(after)?.code).toBe('blocked');
  });

  it('allows only one Minimize and only feedback-capable ports take feedback edges', () => {
    const b = new DocBuilder();
    const v = b.add('value');
    const m1 = b.add('minimize');
    const m2 = b.add('minimize');
    b.wire(v, m1, 'loss');
    b.wire(v, m2, 'loss');
    const sq = b.add('square');
    b.wire(sq, sq, 'x', 'feedback');
    const c = compile(b.build());
    expect(c.errors.get(m1)?.code).toBe('multiple-minimize');
    expect(c.errors.get(sq)?.code).toBe('feedback-port');
    expect(c.minimize).toBeNull();
  });
});

describe('generation with feedback', () => {
  it('counts up through a Previous Value loop', async () => {
    const b = new DocBuilder();
    const prev = b.add('previous', { initial: { shape: [], data: [0] } });
    const one = b.add('value', { value: { shape: [], data: [1] } });
    const sum = b.add('add');
    b.wire(prev, sum, 'a');
    b.wire(one, sum, 'b');
    b.wire(sum, prev, 'x', 'feedback');
    const s = new Session(fetchBytes);
    await s.load(b.build());
    s.generate(5);
    expect(s.valueOf(sum)!.data[0]).toBe(5);
    s.evaluate();
    expect(s.valueOf(sum)!.data[0]).toBe(1);
  });
});

describe('sessions across edits', () => {
  it('keeps trained parameters when unrelated parts of the graph change', async () => {
    const b = new DocBuilder();
    b.doc.training.lr = 0.1;
    const p = b.add('parameter', { shape: [2], init: 'ones' });
    const sq = b.add('square');
    b.wire(p, sq, 'x');
    const mean = b.add('mean');
    b.wire(sq, mean, 'x');
    const min = b.add('minimize');
    b.wire(mean, min, 'loss');
    const doc = b.build();
    const s = new Session(fetchBytes);
    await s.load(doc);
    for (let i = 0; i < 5; i++) s.trainStep();
    const before = Array.from(s.paramValues()[p].data);
    expect(before[0]).toBeLessThan(1);

    const b2 = new DocBuilder(structuredClone(doc));
    const extra = b2.add('peek');
    b2.wire(sq, extra, 'x');
    await s.load(b2.build());
    s.evaluate();
    expect(Array.from(s.paramValues()[p].data)).toEqual(before);
    const snap = s.snapshot();
    expect(snap.grads[`${sq}:out`]).toBeDefined();
    expect(snap.nodes[extra].status).toBe('ok');
  });
});
