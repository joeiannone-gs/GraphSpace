import { z } from 'zod';
import * as O from '@/engine/ops';
import type { SliceItem } from '@/engine/kernels';
import { ShapeError } from '@/engine/tensor';
import { defineNode } from '../types';
import { need, noParams, out, ports } from './helpers';

export const matmul = defineNode({
  type: 'matmul',
  label: 'MatMul',
  category: 'Linear algebra',
  explanation:
    'Matrix product `a @ b`: each output entry is a dot product of a row of `a` with a column of `b`. The last size of `a` must equal the second-to-last size of `b`. Two vectors give their dot product.',
  icon: '/nodes/SVGs/dot.svg',
  display: 'tensor',
  inputs: ports('a', 'b'),
  outputs: out,
  params: noParams,
  fields: [],
  differentiable: true,
  forward: (ctx) => ({ out: O.matmul(ctx.tape, need(ctx, 'a'), need(ctx, 'b')) }),
});

export const transpose = defineNode({
  type: 'transpose',
  label: 'Transpose',
  category: 'Linear algebra',
  explanation: 'Reorders axes. By default swaps the last two (rows ↔ columns).',
  display: 'tensor',
  inputs: ports('x'),
  outputs: out,
  params: z.object({ perm: z.array(z.number().int().min(0)).nullable().default(null) }),
  fields: [{ key: 'perm', label: 'Axis order', kind: 'axes', help: 'Empty swaps the last two axes; `0, 2, 1` reorders.' }],
  differentiable: true,
  forward: (ctx) => ({ out: O.transpose(ctx.tape, need(ctx, 'x'), ctx.p.perm ?? undefined) }),
});

export const reshape = defineNode({
  type: 'reshape',
  label: 'Reshape',
  category: 'Linear algebra',
  explanation: 'Same values, new shape. One size can be `-1` to fill in automatically (`-1` alone flattens).',
  icon: '/nodes/SVGs/flatten.svg',
  display: 'tensor',
  inputs: ports('x'),
  outputs: out,
  params: z.object({ shape: z.array(z.number().int().min(-1)).default([-1]) }),
  fields: [{ key: 'shape', label: 'New shape', kind: 'shape', help: 'For example `-1, 784`.' }],
  differentiable: true,
  forward: (ctx) => ({ out: O.reshape(ctx.tape, need(ctx, 'x'), ctx.p.shape) }),
});

/** Parse NumPy-style slice text like `0:10, :, -1` into slice items. */
export function parseSlice(text: string): SliceItem[] {
  const parts = text.trim() === '' ? [] : text.split(',');
  return parts.map((raw) => {
    const s = raw.trim();
    if (!s.includes(':')) {
      const index = Number(s);
      if (!Number.isInteger(index)) throw new ShapeError(`"${s}" isn't a whole number`);
      return { index };
    }
    const [a, b, c] = s.split(':').map((x) => x.trim());
    const num = (x: string | undefined) => {
      if (x === undefined || x === '') return null;
      const n = Number(x);
      if (!Number.isInteger(n)) throw new ShapeError(`"${x}" isn't a whole number`);
      return n;
    };
    return { start: num(a), stop: num(b), step: num(c) ?? 1 };
  });
}

export const slice = defineNode({
  type: 'slice',
  label: 'Slice',
  category: 'Linear algebra',
  explanation:
    'Picks part of a tensor, NumPy-style: `0:10` takes rows 0–9, `:, 1` takes column 1, `-1` takes the last item.',
  icon: '/nodes/SVGs/slice.svg',
  display: 'tensor',
  inputs: ports('x'),
  outputs: out,
  params: z.object({ spec: z.string().max(200).default(':') }),
  fields: [{ key: 'spec', label: 'Slice', kind: 'slice', help: 'Comma-separated, one part per axis.' }],
  differentiable: true,
  forward: (ctx) => ({ out: O.slice(ctx.tape, need(ctx, 'x'), parseSlice(ctx.p.spec)) }),
});

const MAX_PARTS = 8;

export const concat = defineNode({
  type: 'concat',
  label: 'Concat',
  category: 'Linear algebra',
  explanation: 'Joins tensors end to end along an axis. Other sizes must match.',
  display: 'tensor',
  inputs: (p) => Array.from({ length: p.count }, (_, i) => ({ name: `in${i}`, label: String.fromCharCode(97 + i) })),
  outputs: out,
  params: z.object({ count: z.number().int().min(2).max(MAX_PARTS).default(2), axis: z.number().int().default(-1) }),
  fields: [
    { key: 'count', label: 'Inputs', kind: 'int', min: 2, max: MAX_PARTS },
    { key: 'axis', label: 'Axis', kind: 'int' },
  ],
  differentiable: true,
  forward: (ctx) => ({
    out: O.concat(
      ctx.tape,
      Array.from({ length: ctx.p.count }, (_, i) => need(ctx, `in${i}`)),
      ctx.p.axis,
    ),
  }),
});

export const split = defineNode({
  type: 'split',
  label: 'Split',
  category: 'Linear algebra',
  explanation: 'Cuts a tensor into equal parts along an axis (for example, one part per attention head).',
  display: 'tensor',
  inputs: ports('x'),
  outputs: (p) => Array.from({ length: p.count }, (_, i) => ({ name: `out${i}`, label: String.fromCharCode(97 + i) })),
  params: z.object({ count: z.number().int().min(2).max(MAX_PARTS).default(2), axis: z.number().int().default(-1) }),
  fields: [
    { key: 'count', label: 'Parts', kind: 'int', min: 2, max: MAX_PARTS },
    { key: 'axis', label: 'Axis', kind: 'int' },
  ],
  differentiable: true,
  forward: (ctx) => {
    const parts = O.split(ctx.tape, need(ctx, 'x'), ctx.p.axis, ctx.p.count);
    return Object.fromEntries(parts.map((v, i) => [`out${i}`, v]));
  },
});

export const causalMask = defineNode({
  type: 'causal_mask',
  label: 'Causal Mask',
  category: 'Linear algebra',
  explanation:
    'For attention scores of shape [..., T, T]: hides every position from the “future” (above the diagonal) by setting it to a huge negative number, so softmax gives it zero weight.',
  display: 'tensor',
  inputs: ports('x'),
  outputs: out,
  params: noParams,
  fields: [],
  differentiable: true,
  forward: (ctx) => ({ out: O.causalMask(ctx.tape, need(ctx, 'x')) }),
});
