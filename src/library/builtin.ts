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

function make(
  id: string,
  label: string,
  version: number,
  body: (b: DocBuilder) => void,
  params?: Record<string, number>,
): Subtree {
  const b = new DocBuilder();
  const root = b.group(label, body, { source: { kind: 'builtin', id, version, ...(params ? { params } : {}) } });
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
    }, { inFeatures, outFeatures }),
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
  defaults: { inFeatures: 2, hidden: 16, outFeatures: 2 },
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
    }, { inFeatures, hidden, outFeatures }),
};

function layerNormBody(b: DocBuilder, dModel: number, x: string) {
  const mean = b.add('mean', { axes: [-1], keepdims: true }, { label: 'mean' });
  b.wire(x, mean, 'x');
  const centered = b.add('subtract', {}, { label: 'x − mean' });
  b.wire(x, centered, 'a');
  b.wire(mean, centered, 'b');
  const sq = b.add('square');
  b.wire(centered, sq, 'x');
  const variance = b.add('mean', { axes: [-1], keepdims: true }, { label: 'variance' });
  b.wire(sq, variance, 'x');
  const eps = b.add('value', { value: { shape: [], data: [1e-5] } }, { label: 'ε' });
  const padded = b.add('add');
  b.wire(variance, padded, 'a');
  b.wire(eps, padded, 'b');
  const std = b.add('sqrt', {}, { label: 'std' });
  b.wire(padded, std, 'x');
  const norm = b.add('divide', {}, { label: 'normalized' });
  b.wire(centered, norm, 'a');
  b.wire(std, norm, 'b');
  const gamma = b.add('parameter', { shape: [dModel], init: 'ones' }, { label: 'γ' });
  const beta = b.add('parameter', { shape: [dModel], init: 'zeros' }, { label: 'β' });
  const scaled = b.add('multiply');
  b.wire(norm, scaled, 'a');
  b.wire(gamma, scaled, 'b');
  const shifted = b.add('add');
  b.wire(scaled, shifted, 'a');
  b.wire(beta, shifted, 'b');
  return shifted;
}

export const layerNorm: BuiltinGroup = {
  id: 'layer_norm',
  label: 'LayerNorm',
  explanation: 'Rescales each vector to mean 0 and spread 1 (then a learned scale γ and shift β). Keeps values in a healthy range in deep networks.',
  version: 1,
  fields: [{ key: 'dModel', label: 'Size', kind: 'int', min: 1 }],
  defaults: { dModel: 16 },
  build: ({ dModel }) =>
    make(
      'layer_norm',
      'LayerNorm',
      1,
      (b) => {
        const x = b.input('x');
        b.wire(layerNormBody(b, dModel, x), b.output('y'), 'in');
      },
      { dModel },
    ),
};

export const attention: BuiltinGroup = {
  id: 'attention',
  label: 'Attention',
  explanation:
    'Self-attention (one head): every position makes a query, a key and a value. Each position looks back at earlier positions whose keys match its query (softmax of `q·k / √d`, future hidden by a causal mask) and takes a weighted mix of their values.',
  version: 1,
  fields: [
    { key: 'dModel', label: 'Input size', kind: 'int', min: 1 },
    { key: 'dHead', label: 'Head size', kind: 'int', min: 1 },
  ],
  defaults: { dModel: 16, dHead: 16 },
  build: ({ dModel, dHead }) =>
    make(
      'attention',
      'Attention',
      1,
      (b) => {
        const x = b.input('x');
        const proj = (label: string) => {
          const w = b.add('parameter', { shape: [dModel, dHead], init: 'glorot' }, { label: `W${label}` });
          const mm = b.add('matmul', {}, { label });
          b.wire(x, mm, 'a');
          b.wire(w, mm, 'b');
          return mm;
        };
        const q = proj('q');
        const k = proj('k');
        const v = proj('v');
        const kt = b.add('transpose', {}, { label: 'kᵀ' });
        b.wire(k, kt, 'x');
        const scores = b.add('matmul', {}, { label: 'q · kᵀ' });
        b.wire(q, scores, 'a');
        b.wire(kt, scores, 'b');
        const scale = b.add('value', { value: { shape: [], data: [1 / Math.sqrt(dHead)] } }, { label: '1/√d' });
        const scaled = b.add('multiply');
        b.wire(scores, scaled, 'a');
        b.wire(scale, scaled, 'b');
        const masked = b.add('causal_mask');
        b.wire(scaled, masked, 'x');
        const weights = b.insert(softmax.build({}), { label: 'weights' });
        b.wire(masked, weights, 'x');
        const mixed = b.add('matmul', {}, { label: 'weights · v' });
        b.wire([weights, 'out'], mixed, 'a');
        b.wire(v, mixed, 'b');
        b.wire(mixed, b.output('y'), 'in');
      },
      { dModel, dHead },
    ),
};

export const multiHeadAttention: BuiltinGroup = {
  id: 'multi_head_attention',
  label: 'Multi-Head Attention',
  explanation: 'Several attention heads side by side, each looking for different patterns; their outputs are joined and mixed by a final matrix.',
  version: 1,
  fields: [
    { key: 'dModel', label: 'Size', kind: 'int', min: 1 },
    { key: 'heads', label: 'Heads', kind: 'int', min: 1, max: 8 },
  ],
  defaults: { dModel: 16, heads: 2 },
  build: ({ dModel, heads }) =>
    make(
      'multi_head_attention',
      'Multi-Head Attention',
      1,
      (b) => {
        const h = Math.max(1, Math.min(8, heads));
        const dHead = Math.max(1, Math.floor(dModel / h));
        const x = b.input('x');
        const outs = Array.from({ length: h }, (_, i) => {
          const head = b.insert(attention.build({ dModel, dHead }), { label: `Head ${i + 1}` });
          b.wire(x, head, 'x');
          return head;
        });
        let joined: string = outs[0];
        let joinedPort = 'y';
        if (h > 1) {
          const cat = b.add('concat', { count: h, axis: -1 });
          outs.forEach((o, i) => b.wire([o, 'y'], cat, `in${i}`));
          joined = cat;
          joinedPort = 'out';
        }
        const wo = b.add('parameter', { shape: [dHead * h, dModel], init: 'glorot' }, { label: 'Wo' });
        const mixed = b.add('matmul');
        b.wire([joined, joinedPort], mixed, 'a');
        b.wire(wo, mixed, 'b');
        b.wire(mixed, b.output('y'), 'in');
      },
      { dModel, heads },
    ),
};

export const feedForward: BuiltinGroup = {
  id: 'feed_forward',
  label: 'Feed Forward',
  explanation: 'The per-position “thinking” layer of a transformer: widen (Linear), GELU, and narrow back (Linear).',
  version: 1,
  fields: [
    { key: 'dModel', label: 'Size', kind: 'int', min: 1 },
    { key: 'hidden', label: 'Hidden size', kind: 'int', min: 1 },
  ],
  defaults: { dModel: 16, hidden: 64 },
  build: ({ dModel, hidden }) =>
    make(
      'feed_forward',
      'Feed Forward',
      1,
      (b) => {
        const x = b.input('x');
        const l1 = b.insert(linear.build({ inFeatures: dModel, outFeatures: hidden }));
        b.wire(x, l1, 'x');
        const act = b.add('gelu');
        b.wire([l1, 'y'], act, 'x');
        const l2 = b.insert(linear.build({ inFeatures: hidden, outFeatures: dModel }));
        b.wire(act, l2, 'x');
        b.wire([l2, 'y'], b.output('y'), 'in');
      },
      { dModel, hidden },
    ),
};

export const addNorm: BuiltinGroup = {
  id: 'add_norm',
  label: 'Add & Normalize',
  explanation: 'A residual connection followed by LayerNorm: `LayerNorm(x + sublayer)`. The “shortcut” lets information and gradients skip past the sublayer.',
  version: 1,
  fields: [{ key: 'dModel', label: 'Size', kind: 'int', min: 1 }],
  defaults: { dModel: 16 },
  build: ({ dModel }) =>
    make(
      'add_norm',
      'Add & Normalize',
      1,
      (b) => {
        const x = b.input('x', 0);
        const sub = b.input('sublayer', 1);
        const sum = b.add('add');
        b.wire(x, sum, 'a');
        b.wire(sub, sum, 'b');
        const ln = b.insert(layerNorm.build({ dModel }));
        b.wire(sum, ln, 'x');
        b.wire([ln, 'y'], b.output('y'), 'in');
      },
      { dModel },
    ),
};

export const transformerBlock: BuiltinGroup = {
  id: 'transformer_block',
  label: 'Transformer Block',
  explanation:
    'One layer of a transformer: LayerNorm → Multi-Head Attention (added back to its input), then LayerNorm → Feed Forward (added back again). Stack blocks to make the model deeper.',
  version: 1,
  fields: [
    { key: 'dModel', label: 'Size', kind: 'int', min: 1 },
    { key: 'heads', label: 'Heads', kind: 'int', min: 1, max: 8 },
  ],
  defaults: { dModel: 16, heads: 2 },
  build: ({ dModel, heads }) =>
    make(
      'transformer_block',
      'Transformer Block',
      1,
      (b) => {
        const x = b.input('x');
        const ln1 = b.insert(layerNorm.build({ dModel }));
        b.wire(x, ln1, 'x');
        const att = b.insert(multiHeadAttention.build({ dModel, heads }));
        b.wire([ln1, 'y'], att, 'x');
        const r1 = b.add('add', {}, { label: 'residual' });
        b.wire(x, r1, 'a');
        b.wire([att, 'y'], r1, 'b');
        const ln2 = b.insert(layerNorm.build({ dModel }));
        b.wire(r1, ln2, 'x');
        const ff = b.insert(feedForward.build({ dModel, hidden: dModel * 4 }));
        b.wire([ln2, 'y'], ff, 'x');
        const r2 = b.add('add', {}, { label: 'residual' });
        b.wire(r1, r2, 'a');
        b.wire([ff, 'y'], r2, 'b');
        b.wire(r2, b.output('y'), 'in');
      },
      { dModel, heads },
    ),
};

export const builtinGroups: BuiltinGroup[] = [
  linear,
  mlp,
  mse,
  softmax,
  logSoftmax,
  crossEntropy,
  layerNorm,
  attention,
  multiHeadAttention,
  feedForward,
  addNorm,
  transformerBlock,
];

export function getBuiltin(id: string): BuiltinGroup | undefined {
  return builtinGroups.find((g) => g.id === id);
}
