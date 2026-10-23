/**
 * Differentiable ops on Vars. Each computes its value with kernels and records a VJP on the tape.
 */
import * as K from './kernels';
import { SliceItem } from './kernels';
import { Tape, Var } from './tape';
import { ShapeError, Tensor, full, normAxis, scalar, shapeStr, sizeOf } from './tensor';

type Unary = (t: Tape, x: Var) => Var;

function unary(f: (x: number) => number, df: (x: number, y: number) => number): Unary {
  return (t, x) => {
    const y = K.map(x.value, f);
    return t.record(y, [x], (g) => [K.map(g, (gv, i) => gv * df(x.value.data[i], y.data[i]))]);
  };
}

// ---- elementwise ----

export const add = (t: Tape, a: Var, b: Var): Var =>
  t.record(K.add(a.value, b.value), [a, b], (g) => [K.sumToShape(g, a.value.shape), K.sumToShape(g, b.value.shape)]);

export const sub = (t: Tape, a: Var, b: Var): Var =>
  t.record(K.sub(a.value, b.value), [a, b], (g) => [
    K.sumToShape(g, a.value.shape),
    K.sumToShape(K.neg(g), b.value.shape),
  ]);

export const mul = (t: Tape, a: Var, b: Var): Var =>
  t.record(K.mul(a.value, b.value), [a, b], (g) => [
    a.needsGrad ? K.sumToShape(K.mul(g, b.value), a.value.shape) : null,
    b.needsGrad ? K.sumToShape(K.mul(g, a.value), b.value.shape) : null,
  ]);

export const div = (t: Tape, a: Var, b: Var): Var =>
  t.record(K.div(a.value, b.value), [a, b], (g) => [
    a.needsGrad ? K.sumToShape(K.div(g, b.value), a.value.shape) : null,
    b.needsGrad
      ? K.sumToShape(
          K.zip(K.mul(g, a.value), b.value, (ga, bv) => -ga / (bv * bv)),
          b.value.shape,
        )
      : null,
  ]);

export const neg = unary((x) => -x, () => -1);
export const square = unary((x) => x * x, (x) => 2 * x);
export const sqrt = unary(Math.sqrt, (_x, y) => 0.5 / y);
export const exp = unary(Math.exp, (_x, y) => y);
export const log = unary(Math.log, (x) => 1 / x);
export const sin = unary(Math.sin, Math.cos);
export const cos = unary(Math.cos, (x) => -Math.sin(x));
export const relu = unary((x) => (x > 0 ? x : 0), (x) => (x > 0 ? 1 : 0));
export const tanh = unary(Math.tanh, (_x, y) => 1 - y * y);
export const sigmoid = unary(
  (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x))),
  (_x, y) => y * (1 - y),
);

const GELU_C = Math.sqrt(2 / Math.PI);
export const gelu = unary(
  (x) => 0.5 * x * (1 + Math.tanh(GELU_C * (x + 0.044715 * x * x * x))),
  (x) => {
    const u = GELU_C * (x + 0.044715 * x * x * x);
    const th = Math.tanh(u);
    const du = GELU_C * (1 + 3 * 0.044715 * x * x);
    return 0.5 * (1 + th) + 0.5 * x * (1 - th * th) * du;
  },
);

export const scale = (t: Tape, x: Var, s: number): Var =>
  t.record(K.scale(x.value, s), [x], (g) => [K.scale(g, s)]);

// ---- reductions ----

export type Axes = number[] | null;

function reducedCount(shape: readonly number[], axes: Axes): number {
  if (axes === null) return sizeOf(shape);
  return axes.reduce((acc, a) => acc * shape[normAxis(a, shape.length)], 1);
}

function keptShape(shape: readonly number[], axes: Axes): number[] {
  if (axes === null) return shape.map(() => 1);
  const set = new Set(axes.map((a) => normAxis(a, shape.length)));
  return shape.map((d, i) => (set.has(i) ? 1 : d));
}

export const sum = (t: Tape, x: Var, axes: Axes = null, keepdims = false): Var =>
  t.record(K.reduce(x.value, axes, keepdims, 'sum'), [x], (g) => [
    K.broadcastTo(K.reshape(g, keptShape(x.value.shape, axes)), x.value.shape),
  ]);

export const mean = (t: Tape, x: Var, axes: Axes = null, keepdims = false): Var => {
  const n = reducedCount(x.value.shape, axes);
  if (n === 0) throw new ShapeError('Mean of an empty tensor');
  return t.record(K.scale(K.reduce(x.value, axes, keepdims, 'sum'), 1 / n), [x], (g) => [
    K.scale(K.broadcastTo(K.reshape(g, keptShape(x.value.shape, axes)), x.value.shape), 1 / n),
  ]);
};

export const max = (t: Tape, x: Var, axes: Axes = null, keepdims = false): Var =>
  t.record(K.reduce(x.value, axes, keepdims, 'max'), [x], (g) => [K.maxGrad(x.value, axes, g)]);

// ---- linear algebra and shapes ----

export const reshape = (t: Tape, x: Var, shape: readonly number[]): Var =>
  t.record(K.reshape(x.value, shape), [x], (g) => [K.reshape(g, x.value.shape)]);

export const transpose = (t: Tape, x: Var, perm?: readonly number[]): Var => {
  const p = perm ?? K.defaultPerm(x.value.shape.length);
  return t.record(K.transpose(x.value, p), [x], (g) => [K.transpose(g, K.invertPerm(p))]);
};

/**
 * Matrix product. Rank >= 2 operands batch over leading dims (with broadcasting).
 * A 1-D `a` is treated as a row vector and a 1-D `b` as a column vector, then squeezed (like NumPy).
 */
export const matmul = (t: Tape, a: Var, b: Var): Var => {
  const ra = a.value.shape.length;
  const rb = b.value.shape.length;
  if (ra === 0 || rb === 0) throw new ShapeError('MatMul needs vectors or matrices; use Multiply for scalars');
  const a2 = ra === 1 ? reshape(t, a, [1, a.value.shape[0]]) : a;
  const b2 = rb === 1 ? reshape(t, b, [b.value.shape[0], 1]) : b;
  const out = t.record(K.matmul(a2.value, b2.value), [a2, b2], (g) => [
    a2.needsGrad ? K.sumToShape(K.matmul(g, K.transpose(b2.value, K.defaultPerm(b2.value.shape.length))), a2.value.shape) : null,
    b2.needsGrad ? K.sumToShape(K.matmul(K.transpose(a2.value, K.defaultPerm(a2.value.shape.length)), g), b2.value.shape) : null,
  ]);
  if (ra > 1 && rb > 1) return out;
  const shape = [...out.value.shape];
  if (rb === 1) shape.splice(shape.length - 1, 1);
  if (ra === 1) shape.splice(shape.length - (rb === 1 ? 1 : 2), 1);
  return reshape(t, out, shape);
};

export const slice = (t: Tape, x: Var, spec: readonly SliceItem[]): Var => {
  const r = K.resolveSlice(x.value.shape, spec);
  const kept = K.sliceKeep(x.value, r);
  const shape = kept.shape.filter((_, i) => !r.dropped[i]);
  return t.record(K.reshape(kept, shape), [x], (g) => [
    K.sliceScatter(K.reshape(g, kept.shape), x.value.shape, r),
  ]);
};

export const concat = (t: Tape, xs: readonly Var[], axis: number): Var => {
  const out = K.concat(
    xs.map((x) => x.value),
    axis,
  );
  const ax = normAxis(axis, out.shape.length);
  return t.record(out, xs, (g) => {
    let pos = 0;
    return xs.map((x) => {
      const size = x.value.shape[ax];
      const spec: SliceItem[] = x.value.shape.map((_, i) =>
        i === ax ? { start: pos, stop: pos + size, step: 1 } : { start: null, stop: null, step: 1 },
      );
      pos += size;
      return K.sliceKeep(g, K.resolveSlice(g.shape, spec));
    });
  });
};

/** Split into `parts` equal pieces along `axis`. */
export const split = (t: Tape, x: Var, axis: number, parts: number): Var[] => {
  const ax = normAxis(axis, x.value.shape.length);
  const dim = x.value.shape[ax];
  if (!Number.isInteger(parts) || parts < 1 || dim % parts !== 0) {
    throw new ShapeError(`Can't split size ${dim} into ${parts} equal parts`);
  }
  const size = dim / parts;
  return Array.from({ length: parts }, (_, p) =>
    slice(
      t,
      x,
      x.value.shape.map((_, i) =>
        i === ax ? { start: p * size, stop: (p + 1) * size, step: 1 } : { start: null, stop: null, step: 1 },
      ),
    ),
  );
};

/** Embedding lookup: rows of `table` at integer `idx`. Gradient flows only to the table. */
export const gather = (t: Tape, table: Var, idx: Var): Var =>
  t.record(K.gather(table.value, idx.value), [table, idx], (g) => [
    K.scatterAdd(g, idx.value, table.value.shape),
    null,
  ]);

// ---- neural-net helpers ----

export const softmax = (t: Tape, x: Var, axis = -1): Var => {
  const y = K.softmax(x.value, axis);
  return t.record(y, [x], (g) => {
    const gy = K.mul(g, y);
    const s = K.reduce(gy, [axis], true, 'sum');
    return [K.sub(gy, K.mul(y, s))];
  });
};

export const logSoftmax = (t: Tape, x: Var, axis = -1): Var => {
  const y = K.logSoftmax(x.value, axis);
  return t.record(y, [x], (g) => {
    const s = K.reduce(g, [axis], true, 'sum');
    const p = K.map(y, Math.exp);
    return [K.sub(g, K.mul(p, s))];
  });
};

/**
 * Mean cross-entropy between `logits` [..., C] and `targets`: either one-hot/probabilities with the
 * same shape, or integer class ids shaped like logits without the last axis.
 */
export const softmaxCrossEntropy = (t: Tape, logits: Var, targets: Var): Var => {
  const C = logits.value.shape[logits.value.shape.length - 1];
  const target = toProbabilities(logits.value, targets.value);
  const rows = logits.value.data.length / C;
  const lsm = K.logSoftmax(logits.value, -1);
  let loss = 0;
  for (let i = 0; i < lsm.data.length; i++) loss -= target.data[i] * lsm.data[i];
  return t.record(scalar(loss / rows), [logits, targets], (g) => {
    const p = K.map(lsm, Math.exp);
    const scaleBy = g.data[0] / rows;
    return [K.scale(K.sub(p, target), scaleBy), null];
  });
};

function toProbabilities(logits: Tensor, targets: Tensor): Tensor {
  const shape = logits.shape;
  const C = shape[shape.length - 1];
  if (targets.shape.length === shape.length && targets.shape.every((d, i) => d === shape[i])) return targets;
  if (targets.shape.length === shape.length - 1 && targets.shape.every((d, i) => d === shape[i])) {
    return K.oneHot(targets, C);
  }
  throw new ShapeError(
    `Targets ${shapeStr(targets.shape)} don't match logits ${shapeStr(shape)}: use one-hot targets of the same shape or class ids of shape ${shapeStr(shape.slice(0, -1))}`,
  );
}

export const MASKED = -1e9;

/** Hide future positions: entries above the diagonal of the last two axes become a large negative number. */
export const causalMask = (t: Tape, x: Var): Var => {
  const s = x.value.shape;
  if (s.length < 2 || s[s.length - 1] !== s[s.length - 2]) {
    throw new ShapeError(`Causal mask needs a square [..., T, T] input, got ${shapeStr(s)}`);
  }
  const T = s[s.length - 1];
  const keep = (i: number) => {
    const col = i % T;
    const row = Math.floor(i / T) % T;
    return col <= row;
  };
  return t.record(
    K.map(x.value, (v, i) => (keep(i) ? v : MASKED)),
    [x],
    (g) => [K.map(g, (v, i) => (keep(i) ? v : 0))],
  );
};

// ---- non-differentiable ----

export const argmax = (t: Tape, x: Var, axis = -1): Var => t.constant(K.argmax(x.value, axis));

/** Fraction of rows whose argmax matches the target (one-hot or class ids). */
export const accuracy = (t: Tape, scores: Var, targets: Var): Var => {
  const pred = K.argmax(scores.value, -1);
  const target = toProbabilities(scores.value, targets.value);
  const truth = K.argmax(target, -1);
  let correct = 0;
  for (let i = 0; i < pred.data.length; i++) if (pred.data[i] === truth.data[i]) correct++;
  return t.constant(scalar(pred.data.length ? correct / pred.data.length : 0));
};

export const constant = (t: Tape, value: number, shape: readonly number[] = []): Var => t.constant(full(shape, value));
