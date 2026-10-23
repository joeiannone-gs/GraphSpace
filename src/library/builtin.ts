/**
 * Built-in groups for the HUB, assembled from primitives so learners can open them and see how
 * they work. Each build returns a Subtree that gets copied (fresh ids) into a project.
 */
import { DocBuilder } from '@/doc/builder';
import { Subtree, extractSubtree } from '@/doc/clone';
import type { FieldSpec } from '@/nodes/types';

export interface BuiltinGroup {
  id: string;
  label: string;
  explanation: string;
  version: number;
  fields: FieldSpec[];
  defaults: Record<string, number>;
  build(params: Record<string, number>): Subtree;
}

function make(id: string, label: string, version: number, body: (b: DocBuilder) => void): Subtree {
  const b = new DocBuilder();
  const root = b.group(label, body, { source: { kind: 'builtin', id, version } });
  return extractSubtree(b.build(), root);
}

export const linear: BuiltinGroup = {
  id: 'linear',
  label: 'Linear',
  explanation: 'A fully connected layer: `y = x @ W + b`. Every output is a weighted sum of every input plus a bias.',
  version: 1,
  fields: [
    { key: 'inFeatures', label: 'Inputs', kind: 'int', min: 1 },
    { key: 'outFeatures', label: 'Outputs', kind: 'int', min: 1 },
  ],
  defaults: { inFeatures: 2, outFeatures: 1 },
  build: ({ inFeatures, outFeatures }) =>
    make('linear', 'Linear', 1, (b) => {
      const x = b.input('x');
      const W = b.add('parameter', { shape: [inFeatures, outFeatures], init: 'glorot' }, { label: 'W' });
      const bias = b.add('parameter', { shape: [outFeatures], init: 'zeros' }, { label: 'b' });
      const mm = b.add('matmul');
      b.wire(x, mm, 'a');
      b.wire(W, mm, 'b');
      const add = b.add('add');
      b.wire(mm, add, 'a');
      b.wire(bias, add, 'b');
      b.wire(add, b.output('y'), 'in');
    }),
};

export const mse: BuiltinGroup = {
  id: 'mse',
  label: 'MSE',
  explanation: 'Mean squared error: the average of `(prediction − target)²`. A standard loss for predicting numbers.',
  version: 1,
  fields: [],
  defaults: {},
  build: () =>
    make('mse', 'MSE', 1, (b) => {
      const pred = b.input('prediction', 0);
      const target = b.input('target', 1);
      const diff = b.add('subtract');
      b.wire(pred, diff, 'a');
      b.wire(target, diff, 'b');
      const sq = b.add('square');
      b.wire(diff, sq, 'x');
      const mean = b.add('mean');
      b.wire(sq, mean, 'x');
      b.wire(mean, b.output('loss'), 'in');
    }),
};

function softmaxBody(b: DocBuilder, log: boolean) {
  const x = b.input('x');
  const mx = b.add('max', { axes: [-1], keepdims: true });
  b.wire(x, mx, 'x');
  const shifted = b.add('subtract', {}, { label: 'x − max' });
  b.wire(x, shifted, 'a');
  b.wire(mx, shifted, 'b');
  const e = b.add('exp');
  b.wire(shifted, e, 'x');
  const total = b.add('sum', { axes: [-1], keepdims: true });
  b.wire(e, total, 'x');
  if (log) {
    const lg = b.add('log');
    b.wire(total, lg, 'x');
    const res = b.add('subtract');
    b.wire(shifted, res, 'a');
    b.wire(lg, res, 'b');
    b.wire(res, b.output('out'), 'in');
  } else {
    const d = b.add('divide');
    b.wire(e, d, 'a');
    b.wire(total, d, 'b');
    b.wire(d, b.output('out'), 'in');
  }
}

export const softmax: BuiltinGroup = {
  id: 'softmax',
  label: 'Softmax',
  explanation: 'Turns scores into probabilities that add up to 1 along the last axis: `eˣ / Σ eˣ` (shifted by the max for stability).',
  version: 1,
  fields: [],
  defaults: {},
  build: () => make('softmax', 'Softmax', 1, (b) => softmaxBody(b, false)),
};

export const logSoftmax: BuiltinGroup = {
  id: 'log_softmax',
  label: 'Log Softmax',
  explanation: 'The logarithm of softmax, computed without overflow: `x − max − log Σ e^(x − max)`.',
  version: 1,
  fields: [],
  defaults: {},
  build: () => make('log_softmax', 'Log Softmax', 1, (b) => softmaxBody(b, true)),
};

export const crossEntropy: BuiltinGroup = {
  id: 'cross_entropy',
  label: 'Cross-Entropy',
  explanation:
    'Classification loss: `−mean(Σ targets · log softmax(logits))`. Small when the model gives the right class a high probability.',
  version: 1,
  fields: [],
  defaults: {},
  build: () =>
    make('cross_entropy', 'Cross-Entropy', 1, (b) => {
      const logits = b.input('logits', 0);
      const targets = b.input('targets', 1);
      const lsm = b.insert(logSoftmax.build({}));
      b.wire(logits, lsm, 'x');
      const prod = b.add('multiply');
      b.wire(targets, prod, 'a');
      b.wire([lsm, 'out'], prod, 'b');
      const perRow = b.add('sum', { axes: [-1] });
      b.wire(prod, perRow, 'x');
      const avg = b.add('mean');
      b.wire(perRow, avg, 'x');
      const negated = b.add('negate');
      b.wire(avg, negated, 'x');
      b.wire(negated, b.output('loss'), 'in');
    }),
};

export const mlp: BuiltinGroup = {
  id: 'mlp',
  label: 'MLP',
  explanation: 'A small neural network: Linear → ReLU → Linear.',
  version: 1,
  fields: [
    { key: 'inFeatures', label: 'Inputs', kind: 'int', min: 1 },
    { key: 'hidden', label: 'Hidden units', kind: 'int', min: 1 },
    { key: 'outFeatures', label: 'Outputs', kind: 'int', min: 1 },
  ],
  defaults: { inFeatures: 2, hidden: 8, outFeatures: 2 },
  build: ({ inFeatures, hidden, outFeatures }) =>
    make('mlp', 'MLP', 1, (b) => {
      const x = b.input('x');
      const l1 = b.insert(linear.build({ inFeatures, outFeatures: hidden }));
      b.wire(x, l1, 'x');
      const act = b.add('relu');
      b.wire([l1, 'y'], act, 'x');
      const l2 = b.insert(linear.build({ inFeatures: hidden, outFeatures }));
      b.wire(act, l2, 'x');
      b.wire([l2, 'y'], b.output('y'), 'in');
    }),
};

export const builtinGroups: BuiltinGroup[] = [linear, mlp, mse, softmax, logSoftmax, crossEntropy];

export function getBuiltin(id: string): BuiltinGroup | undefined {
  return builtinGroups.find((g) => g.id === id);
}
