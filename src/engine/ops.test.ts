import { describe, expect, it } from 'vitest';
import * as O from './ops';
import * as K from './kernels';
import { gradcheck } from './gradcheck';
import { Rng } from './rng';
import { Tape, Var } from './tape';
import { ShapeError, Tensor, fromNested, tensor, toNested } from './tensor';

const rng = new Rng(42);
const randn = (shape: number[]) => tensor(shape, Array.from({ length: shape.reduce((a, b) => a * b, 1) }, () => rng.normal()));
const positive = (shape: number[]) => K.map(randn(shape), (x) => 0.5 + Math.abs(x));
const ints = (shape: number[], n: number) =>
  tensor(shape, Array.from({ length: shape.reduce((a, b) => a * b, 1) }, () => rng.int(n)));

type Case = { name: string; inputs: Tensor[]; f: (t: Tape, x: Var[]) => Var; wrt?: number[] };

const cases: Case[] = [
  { name: 'add same shape', inputs: [randn([2, 3]), randn([2, 3])], f: (t, [a, b]) => O.add(t, a, b) },
  { name: 'add broadcast row', inputs: [randn([4, 3]), randn([3])], f: (t, [a, b]) => O.add(t, a, b) },
  { name: 'add broadcast scalar', inputs: [randn([2, 3]), randn([])], f: (t, [a, b]) => O.add(t, a, b) },
  { name: 'add broadcast both', inputs: [randn([4, 1]), randn([1, 3])], f: (t, [a, b]) => O.add(t, a, b) },
  { name: 'sub broadcast', inputs: [randn([2, 3, 4]), randn([3, 1])], f: (t, [a, b]) => O.sub(t, a, b) },
  { name: 'mul broadcast', inputs: [randn([2, 3]), randn([2, 1])], f: (t, [a, b]) => O.mul(t, a, b) },
  { name: 'div broadcast', inputs: [randn([2, 3]), positive([3])], f: (t, [a, b]) => O.div(t, a, b) },
  { name: 'neg', inputs: [randn([5])], f: (t, [a]) => O.neg(t, a) },
  { name: 'square', inputs: [randn([2, 2])], f: (t, [a]) => O.square(t, a) },
  { name: 'sqrt', inputs: [positive([2, 2])], f: (t, [a]) => O.sqrt(t, a) },
  { name: 'exp', inputs: [randn([3])], f: (t, [a]) => O.exp(t, a) },
  { name: 'log', inputs: [positive([3])], f: (t, [a]) => O.log(t, a) },
  { name: 'sin', inputs: [randn([3])], f: (t, [a]) => O.sin(t, a) },
  { name: 'cos', inputs: [randn([3])], f: (t, [a]) => O.cos(t, a) },
  { name: 'relu', inputs: [randn([10])], f: (t, [a]) => O.relu(t, a) },
  { name: 'sigmoid', inputs: [K.scale(randn([6]), 4)], f: (t, [a]) => O.sigmoid(t, a) },
  { name: 'tanh', inputs: [randn([6])], f: (t, [a]) => O.tanh(t, a) },
  { name: 'gelu', inputs: [K.scale(randn([6]), 2)], f: (t, [a]) => O.gelu(t, a) },
  { name: 'scale', inputs: [randn([3])], f: (t, [a]) => O.scale(t, a, -2.5) },
  { name: 'sum all', inputs: [randn([2, 3])], f: (t, [a]) => O.sum(t, a) },
  { name: 'sum axis keepdims', inputs: [randn([2, 3, 4])], f: (t, [a]) => O.sum(t, a, [1], true) },
  { name: 'sum negative axis', inputs: [randn([2, 3, 4])], f: (t, [a]) => O.sum(t, a, [-1]) },
  { name: 'mean all', inputs: [randn([2, 3])], f: (t, [a]) => O.mean(t, a) },
  { name: 'mean axes', inputs: [randn([2, 3, 4])], f: (t, [a]) => O.mean(t, a, [0, 2]) },
  { name: 'max axis', inputs: [randn([3, 5])], f: (t, [a]) => O.max(t, a, [1]) },
  { name: 'max all keepdims', inputs: [randn([3, 2])], f: (t, [a]) => O.max(t, a, null, true) },
  { name: 'reshape', inputs: [randn([2, 6])], f: (t, [a]) => O.reshape(t, a, [3, -1]) },
  { name: 'transpose default', inputs: [randn([2, 3, 4])], f: (t, [a]) => O.transpose(t, a) },
  { name: 'transpose perm', inputs: [randn([2, 3, 4])], f: (t, [a]) => O.transpose(t, a, [2, 0, 1]) },
  { name: 'matmul 2d', inputs: [randn([3, 4]), randn([4, 2])], f: (t, [a, b]) => O.matmul(t, a, b) },
  { name: 'matmul batched', inputs: [randn([2, 3, 4]), randn([2, 4, 5])], f: (t, [a, b]) => O.matmul(t, a, b) },
  { name: 'matmul broadcast batch', inputs: [randn([2, 3, 4]), randn([4, 5])], f: (t, [a, b]) => O.matmul(t, a, b) },
  { name: 'matmul vector-matrix', inputs: [randn([4]), randn([4, 3])], f: (t, [a, b]) => O.matmul(t, a, b) },
  { name: 'matmul matrix-vector', inputs: [randn([3, 4]), randn([4])], f: (t, [a, b]) => O.matmul(t, a, b) },
  { name: 'matmul dot', inputs: [randn([4]), randn([4])], f: (t, [a, b]) => O.matmul(t, a, b) },
  {
    name: 'slice ranges',
    inputs: [randn([4, 5])],
    f: (t, [a]) => O.slice(t, a, [{ start: 1, stop: 4, step: 2 }, { start: -3, stop: null, step: 1 }]),
  },
  { name: 'slice index', inputs: [randn([4, 5])], f: (t, [a]) => O.slice(t, a, [{ index: 2 }]) },
  { name: 'concat', inputs: [randn([2, 3]), randn([2, 2])], f: (t, [a, b]) => O.concat(t, [a, b], 1) },
  {
    name: 'split',
    inputs: [randn([2, 6])],
    f: (t, [a]) => {
      const [x, y, z] = O.split(t, a, -1, 3);
      return O.add(t, O.mul(t, x, y), z);
    },
  },
  { name: 'gather', inputs: [randn([5, 3]), ints([2, 4], 5)], f: (t, [a, i]) => O.gather(t, a, i), wrt: [0] },
  { name: 'softmax', inputs: [randn([3, 4])], f: (t, [a]) => O.softmax(t, a) },
  { name: 'softmax axis 0', inputs: [randn([3, 4])], f: (t, [a]) => O.softmax(t, a, 0) },
  { name: 'logSoftmax', inputs: [randn([3, 4])], f: (t, [a]) => O.logSoftmax(t, a) },
  {
    name: 'softmaxCrossEntropy one-hot',
    inputs: [randn([4, 3]), K.oneHot(ints([4], 3), 3)],
    f: (t, [a, y]) => O.softmaxCrossEntropy(t, a, y),
    wrt: [0],
  },
  {
    name: 'softmaxCrossEntropy ids',
    inputs: [randn([2, 3, 5]), ints([2, 3], 5)],
    f: (t, [a, y]) => O.softmaxCrossEntropy(t, a, y),
    wrt: [0],
  },
  {
    name: 'causalMask then softmax',
    inputs: [randn([2, 3, 3])],
    f: (t, [a]) => O.softmax(t, O.causalMask(t, a)),
  },
];

describe('gradients match finite differences', () => {
  for (const c of cases) {
    it(c.name, () => {
      const r = gradcheck(c.f, c.inputs, c.wrt);
      expect(r.maxError, JSON.stringify(r.worst)).toBeLessThan(1e-5);
    });
  }
});

describe('forward values', () => {
  const run = (f: (t: Tape) => Var) => toNested(f(new Tape()).value);
  const c = (t: Tape, v: Parameters<typeof fromNested>[0]) => t.constant(fromNested(v));

  it('matmul', () => {
    expect(run((t) => O.matmul(t, c(t, [[1, 2], [3, 4]]), c(t, [[5], [6]])))).toEqual([[17], [39]]);
    expect(run((t) => O.matmul(t, c(t, [1, 2, 3]), c(t, [4, 5, 6])))).toEqual(32);
  });

  it('broadcast add', () => {
    expect(run((t) => O.add(t, c(t, [[1], [2]]), c(t, [10, 20, 30])))).toEqual([
      [11, 21, 31],
      [12, 22, 32],
    ]);
  });

  it('reductions', () => {
    const x = [[1, 5, 2], [7, 0, 3]];
    expect(run((t) => O.sum(t, c(t, x), [0]))).toEqual([8, 5, 5]);
    const m = run((t) => O.mean(t, c(t, x), [1], true)) as number[][];
    expect(m[0][0]).toBeCloseTo(8 / 3);
    expect(m[1][0]).toBeCloseTo(10 / 3);
    expect(run((t) => O.max(t, c(t, x), [-1]))).toEqual([5, 7]);
    expect(run((t) => O.argmax(t, c(t, x), -1))).toEqual([1, 0]);
  });

  it('slice and transpose', () => {
    const x = [[0, 1, 2], [3, 4, 5]];
    expect(run((t) => O.slice(t, c(t, x), [{ start: null, stop: null, step: 1 }, { index: -1 }]))).toEqual([2, 5]);
    expect(run((t) => O.transpose(t, c(t, x)))).toEqual([[0, 3], [1, 4], [2, 5]]);
  });

  it('softmax rows sum to one and masked entries are zero', () => {
    const out = run((t) => O.softmax(t, O.causalMask(t, c(t, [[1, 2, 3], [4, 5, 6], [7, 8, 9]])))) as number[][];
    for (const row of out) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(out[0][1]).toBe(0);
    expect(out[0][0]).toBe(1);
  });

  it('cross entropy of a perfect guess is near zero and accuracy counts matches', () => {
    const logits = [[10, -10], [-10, 10]];
    expect(run((t) => O.softmaxCrossEntropy(t, c(t, logits), c(t, [0, 1])))).toBeCloseTo(0, 6);
    expect(run((t) => O.accuracy(t, c(t, logits), c(t, [0, 0])))).toBe(0.5);
  });

  it('gives friendly shape errors', () => {
    expect(() => run((t) => O.matmul(t, c(t, [[1, 2]]), c(t, [[1, 2]])))).toThrow(ShapeError);
    expect(() => run((t) => O.add(t, c(t, [1, 2]), c(t, [1, 2, 3])))).toThrow(/can't be combined/);
    expect(() => run((t) => O.reshape(t, c(t, [1, 2, 3]), [2, -1]))).toThrow(/reshape/);
  });

  it('accumulates gradients when a value is used twice', () => {
    const t = new Tape();
    const x = t.leaf(fromNested([3]));
    const y = O.mul(t, x, x);
    const g = t.backward(O.sum(t, y));
    expect(toNested(g.get(x.id)!)).toEqual([6]);
  });
});
