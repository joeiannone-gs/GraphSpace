/**
 * Pure tensor kernels (no autodiff). Ops in ops.ts compose these for both the forward pass and
 * the vector-Jacobian products. Everything here could later be swapped for WASM/WebGPU versions.
 */
import {
  ShapeError,
  Tensor,
  broadcastShapes,
  normAxis,
  sameShape,
  shapeStr,
  sizeOf,
  stridesOf,
  tensor,
} from './tensor';

export function map(t: Tensor, f: (x: number, i: number) => number): Tensor {
  const out = new Float64Array(t.data.length);
  for (let i = 0; i < out.length; i++) out[i] = f(t.data[i], i);
  return { shape: [...t.shape], data: out };
}

/** Strides of `shape` laid out inside `outShape` for broadcasting (0 where the dim is broadcast). */
function broadcastStrides(shape: readonly number[], outShape: readonly number[]): number[] {
  const strides = stridesOf(shape);
  const rank = outShape.length;
  const out = new Array<number>(rank).fill(0);
  for (let i = 0; i < shape.length; i++) {
    const oi = rank - shape.length + i;
    out[oi] = shape[i] === 1 ? 0 : strides[i];
  }
  return out;
}

/** Elementwise binary op with NumPy broadcasting. */
export function zip(a: Tensor, b: Tensor, f: (x: number, y: number) => number): Tensor {
  if (sameShape(a.shape, b.shape)) {
    const out = new Float64Array(a.data.length);
    for (let i = 0; i < out.length; i++) out[i] = f(a.data[i], b.data[i]);
    return { shape: [...a.shape], data: out };
  }
  const shape = broadcastShapes(a.shape, b.shape);
  const n = sizeOf(shape);
  const out = new Float64Array(n);
  if (b.data.length === 1) {
    const y = b.data[0];
    if (a.data.length === n) {
      for (let i = 0; i < n; i++) out[i] = f(a.data[i], y);
      return { shape, data: out };
    }
  }
  if (a.data.length === 1 && b.data.length === n) {
    const x = a.data[0];
    for (let i = 0; i < n; i++) out[i] = f(x, b.data[i]);
    return { shape, data: out };
  }
  const sa = broadcastStrides(a.shape, shape);
  const sb = broadcastStrides(b.shape, shape);
  const rank = shape.length;
  const idx = new Array<number>(rank).fill(0);
  let oa = 0;
  let ob = 0;
  for (let i = 0; i < n; i++) {
    out[i] = f(a.data[oa], b.data[ob]);
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      oa += sa[d];
      ob += sb[d];
      if (idx[d] < shape[d]) break;
      oa -= sa[d] * shape[d];
      ob -= sb[d] * shape[d];
      idx[d] = 0;
    }
  }
  return { shape, data: out };
}

export function broadcastTo(t: Tensor, shape: readonly number[]): Tensor {
  if (sameShape(t.shape, shape)) return t;
  const target = broadcastShapes(t.shape, shape);
  if (!sameShape(target, shape)) {
    throw new ShapeError(`Can't broadcast ${shapeStr(t.shape)} to ${shapeStr(shape)}`);
  }
  return zip(t, tensor(shape), (x) => x);
}

/** Sum `g` (shaped like a broadcast result) back down to `shape`. Used by every broadcasting VJP. */
export function sumToShape(g: Tensor, shape: readonly number[]): Tensor {
  if (sameShape(g.shape, shape)) return g;
  const rank = g.shape.length;
  const axes: number[] = [];
  for (let i = 0; i < rank; i++) {
    const si = i - (rank - shape.length);
    if (si < 0 || (shape[si] === 1 && g.shape[i] !== 1)) axes.push(i);
  }
  const summed = reduce(g, axes, true, 'sum');
  return reshape(summed, shape);
}

export function reshape(t: Tensor, shape: readonly number[]): Tensor {
  const resolved = resolveShape(shape, t.data.length);
  return { shape: resolved, data: t.data };
}

/** Resolve a target shape that may contain one -1. */
export function resolveShape(shape: readonly number[], size: number): number[] {
  const out = [...shape];
  const inferred = out.indexOf(-1);
  if (inferred !== -1) {
    if (out.indexOf(-1, inferred + 1) !== -1) throw new ShapeError('Only one dimension can be -1');
    const known = out.reduce((acc, d, i) => (i === inferred ? acc : acc * d), 1);
    if (known === 0 || size % known !== 0) {
      throw new ShapeError(`Can't reshape ${size} values into ${shapeStr(shape)}`);
    }
    out[inferred] = size / known;
  }
  if (sizeOf(out) !== size) {
    throw new ShapeError(`Can't reshape ${size} values into ${shapeStr(shape)} (${sizeOf(out)} values)`);
  }
  return out;
}

export type ReduceOp = 'sum' | 'max';

/** Reduce over `axes` (all axes when null). */
export function reduce(t: Tensor, axes: readonly number[] | null, keepdims: boolean, op: ReduceOp): Tensor {
  const rank = t.shape.length;
  const reduced = new Set((axes ?? t.shape.map((_, i) => i)).map((a) => normAxis(a, rank)));
  const keptShape = t.shape.map((d, i) => (reduced.has(i) ? 1 : d));
  const outSize = sizeOf(keptShape);
  const out = new Float64Array(outSize).fill(op === 'max' ? -Infinity : 0);
  const outStrides = broadcastStrides(keptShape, t.shape);
  const idx = new Array<number>(rank).fill(0);
  let o = 0;
  for (let i = 0; i < t.data.length; i++) {
    const v = t.data[i];
    if (op === 'sum') out[o] += v;
    else if (v > out[o]) out[o] = v;
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      o += outStrides[d];
      if (idx[d] < t.shape[d]) break;
      o -= outStrides[d] * t.shape[d];
      idx[d] = 0;
    }
  }
  const shape = keepdims ? keptShape : t.shape.filter((_, i) => !reduced.has(i));
  return { shape, data: out };
}

/** Index of the max along one axis (first one on ties); the axis is removed. */
export function argmax(t: Tensor, axis: number): Tensor {
  const ax = normAxis(axis, t.shape.length);
  const outer = sizeOf(t.shape.slice(0, ax));
  const n = t.shape[ax];
  const inner = sizeOf(t.shape.slice(ax + 1));
  const out = new Float64Array(outer * inner);
  for (let o = 0; o < outer; o++) {
    for (let k = 0; k < inner; k++) {
      let best = -Infinity;
      let bestI = 0;
      for (let i = 0; i < n; i++) {
        const v = t.data[(o * n + i) * inner + k];
        if (v > best) {
          best = v;
          bestI = i;
        }
      }
      out[o * inner + k] = bestI;
    }
  }
  return { shape: t.shape.filter((_, i) => i !== ax), data: out };
}

/** Gradient of a max-reduction: route each upstream value to the first maximal input. */
export function maxGrad(x: Tensor, axes: readonly number[] | null, g: Tensor): Tensor {
  const rank = x.shape.length;
  const reduced = new Set((axes ?? x.shape.map((_, i) => i)).map((a) => normAxis(a, rank)));
  const keptShape = x.shape.map((d, i) => (reduced.has(i) ? 1 : d));
  const maxes = reduce(x, axes, true, 'max');
  const gk = reshape(g, keptShape);
  const taken = new Uint8Array(maxes.data.length);
  const out = new Float64Array(x.data.length);
  const outStrides = broadcastStrides(keptShape, x.shape);
  const idx = new Array<number>(rank).fill(0);
  let o = 0;
  for (let i = 0; i < x.data.length; i++) {
    if (!taken[o] && x.data[i] === maxes.data[o]) {
      out[i] = gk.data[o];
      taken[o] = 1;
    }
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      o += outStrides[d];
      if (idx[d] < x.shape[d]) break;
      o -= outStrides[d] * x.shape[d];
      idx[d] = 0;
    }
  }
  return { shape: [...x.shape], data: out };
}

/** Batched matrix multiply of tensors with rank >= 2; batch dims broadcast. */
export function matmul(a: Tensor, b: Tensor): Tensor {
  const ra = a.shape.length;
  const rb = b.shape.length;
  if (ra < 2 || rb < 2) throw new ShapeError('matmul kernel needs rank >= 2');
  const m = a.shape[ra - 2];
  const k = a.shape[ra - 1];
  const k2 = b.shape[rb - 2];
  const n = b.shape[rb - 1];
  if (k !== k2) {
    throw new ShapeError(
      `a is ${shapeStr(a.shape)} and b is ${shapeStr(b.shape)}: the last size of a (${k}) must equal the second-to-last size of b (${k2})`,
    );
  }
  const batchA = a.shape.slice(0, ra - 2);
  const batchB = b.shape.slice(0, rb - 2);
  const batch = broadcastShapes(batchA, batchB);
  const nb = sizeOf(batch);
  const out = new Float64Array(nb * m * n);
  const sa = broadcastStrides(batchA, batch);
  const sb = broadcastStrides(batchB, batch);
  const idx = new Array<number>(batch.length).fill(0);
  let ma = 0;
  let mb = 0;
  for (let bi = 0; bi < nb; bi++) {
    const aOff = ma * m * k;
    const bOff = mb * k * n;
    const oOff = bi * m * n;
    for (let i = 0; i < m; i++) {
      for (let p = 0; p < k; p++) {
        const av = a.data[aOff + i * k + p];
        if (av === 0) continue;
        const bRow = bOff + p * n;
        const oRow = oOff + i * n;
        for (let j = 0; j < n; j++) out[oRow + j] += av * b.data[bRow + j];
      }
    }
    for (let d = batch.length - 1; d >= 0; d--) {
      idx[d]++;
      ma += sa[d];
      mb += sb[d];
      if (idx[d] < batch[d]) break;
      ma -= sa[d] * batch[d];
      mb -= sb[d] * batch[d];
      idx[d] = 0;
    }
  }
  return { shape: [...batch, m, n], data: out };
}

export function transpose(t: Tensor, perm: readonly number[]): Tensor {
  const rank = t.shape.length;
  if (perm.length !== rank || new Set(perm).size !== rank || perm.some((p) => p < 0 || p >= rank)) {
    throw new ShapeError(`Permutation [${perm.join(', ')}] doesn't match a tensor with ${rank} dimensions`);
  }
  const inStrides = stridesOf(t.shape);
  const shape = perm.map((p) => t.shape[p]);
  const srcStrides = perm.map((p) => inStrides[p]);
  const n = t.data.length;
  const out = new Float64Array(n);
  const idx = new Array<number>(rank).fill(0);
  let src = 0;
  for (let i = 0; i < n; i++) {
    out[i] = t.data[src];
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      src += srcStrides[d];
      if (idx[d] < shape[d]) break;
      src -= srcStrides[d] * shape[d];
      idx[d] = 0;
    }
  }
  return { shape, data: out };
}

export function invertPerm(perm: readonly number[]): number[] {
  const inv = new Array<number>(perm.length);
  perm.forEach((p, i) => (inv[p] = i));
  return inv;
}

/** Swap the last two axes. */
export function defaultPerm(rank: number): number[] {
  const perm = Array.from({ length: rank }, (_, i) => i);
  if (rank >= 2) [perm[rank - 2], perm[rank - 1]] = [perm[rank - 1], perm[rank - 2]];
  return perm;
}

/** One entry per leading axis: a half-open range with a positive step, or a single index (drops the axis). */
export type SliceItem = { start: number | null; stop: number | null; step: number } | { index: number };

export interface ResolvedSlice {
  ranges: { start: number; step: number; count: number }[];
  dropped: boolean[];
}

export function resolveSlice(shape: readonly number[], spec: readonly SliceItem[]): ResolvedSlice {
  if (spec.length > shape.length) {
    throw new ShapeError(`Slice has ${spec.length} parts but the tensor has only ${shape.length} dimensions`);
  }
  const ranges: ResolvedSlice['ranges'] = [];
  const dropped: boolean[] = [];
  shape.forEach((dim, axis) => {
    const item = spec[axis];
    if (!item) {
      ranges.push({ start: 0, step: 1, count: dim });
      dropped.push(false);
      return;
    }
    if ('index' in item) {
      const i = item.index < 0 ? item.index + dim : item.index;
      if (i < 0 || i >= dim) throw new ShapeError(`Index ${item.index} is out of range for size ${dim}`);
      ranges.push({ start: i, step: 1, count: 1 });
      dropped.push(true);
      return;
    }
    const step = item.step;
    if (!Number.isInteger(step) || step <= 0) throw new ShapeError('Slice step must be a positive whole number');
    const clamp = (v: number) => Math.min(Math.max(v < 0 ? v + dim : v, 0), dim);
    const start = item.start === null ? 0 : clamp(item.start);
    const stop = item.stop === null ? dim : clamp(item.stop);
    const count = stop > start ? Math.ceil((stop - start) / step) : 0;
    ranges.push({ start, step, count });
    dropped.push(false);
  });
  return { ranges, dropped };
}

/** Copy the slice out (keepShape keeps dropped axes as size 1; callers reshape afterwards). */
export function sliceKeep(t: Tensor, r: ResolvedSlice): Tensor {
  const shape = r.ranges.map((x) => x.count);
  const n = sizeOf(shape);
  const out = new Float64Array(n);
  const strides = stridesOf(t.shape);
  const rank = shape.length;
  if (n === 0) return { shape, data: out };
  const idx = new Array<number>(rank).fill(0);
  let src = r.ranges.reduce((acc, x, d) => acc + x.start * strides[d], 0);
  for (let i = 0; i < n; i++) {
    out[i] = t.data[src];
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      src += r.ranges[d].step * strides[d];
      if (idx[d] < shape[d]) break;
      src -= r.ranges[d].step * strides[d] * shape[d];
      idx[d] = 0;
    }
  }
  return { shape, data: out };
}

/** Inverse of sliceKeep: scatter `g` (shaped like the kept slice) into zeros of `shape`. */
export function sliceScatter(g: Tensor, shape: readonly number[], r: ResolvedSlice): Tensor {
  const out = new Float64Array(sizeOf(shape));
  const strides = stridesOf(shape);
  const gShape = r.ranges.map((x) => x.count);
  const n = sizeOf(gShape);
  const rank = gShape.length;
  if (n === 0) return { shape: [...shape], data: out };
  const idx = new Array<number>(rank).fill(0);
  let dst = r.ranges.reduce((acc, x, d) => acc + x.start * strides[d], 0);
  for (let i = 0; i < n; i++) {
    out[dst] += g.data[i];
    for (let d = rank - 1; d >= 0; d--) {
      idx[d]++;
      dst += r.ranges[d].step * strides[d];
      if (idx[d] < gShape[d]) break;
      dst -= r.ranges[d].step * strides[d] * gShape[d];
      idx[d] = 0;
    }
  }
  return { shape: [...shape], data: out };
}

export function concat(ts: readonly Tensor[], axis: number): Tensor {
  if (ts.length === 0) throw new ShapeError('Nothing to concatenate');
  const rank = ts[0].shape.length;
  const ax = normAxis(axis, rank);
  for (const t of ts) {
    if (t.shape.length !== rank || t.shape.some((d, i) => i !== ax && d !== ts[0].shape[i])) {
      throw new ShapeError(
        `Can't concatenate ${ts.map((x) => shapeStr(x.shape)).join(' and ')} along axis ${axis}: other sizes must match`,
      );
    }
  }
  const outer = sizeOf(ts[0].shape.slice(0, ax));
  const inner = sizeOf(ts[0].shape.slice(ax + 1));
  const total = ts.reduce((acc, t) => acc + t.shape[ax], 0);
  const shape = [...ts[0].shape];
  shape[ax] = total;
  const out = new Float64Array(sizeOf(shape));
  for (let o = 0; o < outer; o++) {
    let pos = 0;
    for (const t of ts) {
      const chunk = t.shape[ax] * inner;
      out.set(t.data.subarray(o * chunk, (o + 1) * chunk), o * total * inner + pos * inner);
      pos += t.shape[ax];
    }
  }
  return { shape, data: out };
}

/** Rows of `table` ([V, ...]) picked by integer `idx` (any shape) → idx.shape ++ table.shape[1:]. */
export function gather(table: Tensor, idx: Tensor): Tensor {
  const V = table.shape[0];
  const row = sizeOf(table.shape.slice(1));
  const out = new Float64Array(idx.data.length * row);
  for (let i = 0; i < idx.data.length; i++) {
    const r = Math.round(idx.data[i]);
    if (r < 0 || r >= V) throw new ShapeError(`Index ${r} is out of range: the table has ${V} rows`);
    out.set(table.data.subarray(r * row, (r + 1) * row), i * row);
  }
  return { shape: [...idx.shape, ...table.shape.slice(1)], data: out };
}

export function scatterAdd(g: Tensor, idx: Tensor, tableShape: readonly number[]): Tensor {
  const row = sizeOf(tableShape.slice(1));
  const out = new Float64Array(sizeOf(tableShape));
  for (let i = 0; i < idx.data.length; i++) {
    const r = Math.round(idx.data[i]);
    for (let j = 0; j < row; j++) out[r * row + j] += g.data[i * row + j];
  }
  return { shape: [...tableShape], data: out };
}

/** Softmax along `axis`, computed stably. */
export function softmax(t: Tensor, axis: number): Tensor {
  const m = reduce(t, [axis], true, 'max');
  const e = zip(t, m, (x, mx) => Math.exp(x - mx));
  const s = reduce(e, [axis], true, 'sum');
  return zip(e, s, (x, y) => x / y);
}

export function logSoftmax(t: Tensor, axis: number): Tensor {
  const m = reduce(t, [axis], true, 'max');
  const shifted = zip(t, m, (x, mx) => x - mx);
  const lse = map(reduce(map(shifted, Math.exp), [axis], true, 'sum'), Math.log);
  return zip(shifted, lse, (x, l) => x - l);
}

export function oneHot(idx: Tensor, classes: number): Tensor {
  const out = new Float64Array(idx.data.length * classes);
  for (let i = 0; i < idx.data.length; i++) {
    const c = Math.round(idx.data[i]);
    if (c < 0 || c >= classes) throw new ShapeError(`Class ${c} is out of range for ${classes} classes`);
    out[i * classes + c] = 1;
  }
  return { shape: [...idx.shape, classes], data: out };
}

export const add = (a: Tensor, b: Tensor) => zip(a, b, (x, y) => x + y);
export const sub = (a: Tensor, b: Tensor) => zip(a, b, (x, y) => x - y);
export const mul = (a: Tensor, b: Tensor) => zip(a, b, (x, y) => x * y);
export const div = (a: Tensor, b: Tensor) => zip(a, b, (x, y) => x / y);
export const neg = (a: Tensor) => map(a, (x) => -x);
export const scale = (a: Tensor, s: number) => map(a, (x) => x * s);
