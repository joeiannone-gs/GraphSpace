/**
 * Dense row-major tensors of float64. Integer data (class labels, token ids) is stored as floats.
 * Tensors are plain objects so they survive structured cloning to and from the worker.
 */
export interface Tensor {
  readonly shape: readonly number[];
  readonly data: Float64Array;
}

export type Nested = number | Nested[];

/** A shape or size problem the learner can fix; the message is shown on the node. */
export class ShapeError extends Error {
  override name = 'ShapeError';
}

export function sizeOf(shape: readonly number[]): number {
  let n = 1;
  for (const d of shape) n *= d;
  return n;
}

export function shapeStr(shape: readonly number[]): string {
  return `[${shape.join(', ')}]`;
}

export function sameShape(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

export function stridesOf(shape: readonly number[]): number[] {
  const strides = new Array<number>(shape.length);
  let s = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    strides[i] = s;
    s *= shape[i];
  }
  return strides;
}

export function tensor(shape: readonly number[], data?: ArrayLike<number>): Tensor {
  for (const d of shape) {
    if (!Number.isInteger(d) || d < 0) throw new ShapeError(`Invalid shape ${shapeStr(shape)}`);
  }
  const n = sizeOf(shape);
  if (data === undefined) return { shape: [...shape], data: new Float64Array(n) };
  if (data.length !== n) {
    throw new ShapeError(`Shape ${shapeStr(shape)} needs ${n} values but got ${data.length}`);
  }
  return { shape: [...shape], data: Float64Array.from(data) };
}

export const zeros = (shape: readonly number[]): Tensor => tensor(shape);

export function full(shape: readonly number[], value: number): Tensor {
  const t = tensor(shape);
  t.data.fill(value);
  return t;
}

export const scalar = (value: number): Tensor => ({ shape: [], data: Float64Array.of(value) });

export function fromNested(value: Nested): Tensor {
  const shape: number[] = [];
  let probe: Nested = value;
  while (Array.isArray(probe)) {
    shape.push(probe.length);
    if (probe.length === 0) break;
    probe = probe[0];
  }
  const data: number[] = [];
  const walk = (v: Nested, depth: number) => {
    if (depth === shape.length) {
      if (typeof v !== 'number') throw new ShapeError('Ragged array: rows must all have the same length');
      data.push(v);
      return;
    }
    if (!Array.isArray(v) || v.length !== shape[depth]) {
      throw new ShapeError('Ragged array: rows must all have the same length');
    }
    for (const item of v) walk(item, depth + 1);
  };
  walk(value, 0);
  return tensor(shape, data);
}

export function toNested(t: Tensor): Nested {
  if (t.shape.length === 0) return t.data[0];
  const strides = stridesOf(t.shape);
  const build = (depth: number, offset: number): Nested => {
    const out: Nested[] = [];
    for (let i = 0; i < t.shape[depth]; i++) {
      const o = offset + i * strides[depth];
      out.push(depth === t.shape.length - 1 ? t.data[o] : build(depth + 1, o));
    }
    return out;
  };
  return build(0, 0);
}

export function clone(t: Tensor): Tensor {
  return { shape: [...t.shape], data: new Float64Array(t.data) };
}

/** Python-style axis: negative counts from the end. */
export function normAxis(axis: number, rank: number): number {
  const a = axis < 0 ? axis + rank : axis;
  if (!Number.isInteger(a) || a < 0 || a >= rank) {
    throw new ShapeError(`Axis ${axis} is out of range for a tensor with ${rank} dimension${rank === 1 ? '' : 's'}`);
  }
  return a;
}

/** NumPy broadcasting: align trailing dimensions; each pair must match or one must be 1. */
export function broadcastShapes(a: readonly number[], b: readonly number[]): number[] {
  const rank = Math.max(a.length, b.length);
  const out = new Array<number>(rank);
  for (let i = 0; i < rank; i++) {
    const da = a[a.length - rank + i] ?? 1;
    const db = b[b.length - rank + i] ?? 1;
    if (da !== db && da !== 1 && db !== 1) {
      throw new ShapeError(`Shapes ${shapeStr(a)} and ${shapeStr(b)} can't be combined: sizes ${da} and ${db} differ`);
    }
    out[i] = da === 1 ? db : da;
  }
  return out;
}

export interface TensorStats {
  min: number;
  max: number;
  mean: number;
  absMean: number;
}

export function stats(t: Tensor): TensorStats {
  const n = t.data.length;
  if (n === 0) return { min: 0, max: 0, mean: 0, absMean: 0 };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let abs = 0;
  for (let i = 0; i < n; i++) {
    const v = t.data[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    abs += Math.abs(v);
  }
  return { min, max, mean: sum / n, absMean: abs / n };
}
