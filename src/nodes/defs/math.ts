import { z } from 'zod';
import * as O from '@/engine/ops';
import type { Tape, Var } from '@/engine/tape';
import { defineNode, type Category } from '../types';
import { axesParam, need, noParams, out, ports } from './helpers';

function binary(
  type: string,
  label: string,
  explanation: string,
  icon: string | undefined,
  f: (t: Tape, a: Var, b: Var) => Var,
) {
  return defineNode({
    type,
    label,
    category: 'Math',
    explanation: `${explanation} Shapes broadcast like NumPy: a size-1 dimension stretches to match.`,
    icon,
    display: 'tensor',
    inputs: ports('a', 'b'),
    outputs: out,
    params: noParams,
    fields: [],
    differentiable: true,
    forward: (ctx) => ({ out: f(ctx.tape, need(ctx, 'a'), need(ctx, 'b')) }),
  });
}

function unary(
  type: string,
  label: string,
  category: Category,
  explanation: string,
  icon: string | undefined,
  f: (t: Tape, x: Var) => Var,
) {
  return defineNode({
    type,
    label,
    category,
    explanation,
    icon,
    display: 'tensor',
    inputs: ports('x'),
    outputs: out,
    params: noParams,
    fields: [],
    differentiable: true,
    forward: (ctx) => ({ out: f(ctx.tape, need(ctx, 'x')) }),
  });
}

function reduction(type: string, label: string, explanation: string, icon: string | undefined, f: typeof O.sum) {
  return defineNode({
    type,
    label,
    category: 'Math',
    explanation: `${explanation} Choose which axes to collapse, or leave empty for all of them.`,
    icon,
    display: 'tensor',
    inputs: ports('x'),
    outputs: out,
    params: z.object({ axes: axesParam, keepdims: z.boolean().default(false) }),
    fields: [
      { key: 'axes', label: 'Axes', kind: 'axes', help: 'Empty = all. `-1` is the last axis.' },
      { key: 'keepdims', label: 'Keep dimensions', kind: 'bool' },
    ],
    differentiable: true,
    forward: (ctx) => ({ out: f(ctx.tape, need(ctx, 'x'), ctx.p.axes, ctx.p.keepdims) }),
  });
}

export const add = binary('add', 'Add', 'Adds `a` and `b` element by element.', '/nodes/SVGs/add.svg', O.add);
export const subtract = binary('subtract', 'Subtract', 'Computes `a − b` element by element.', '/nodes/SVGs/subtract.svg', O.sub);
export const multiply = binary('multiply', 'Multiply', 'Multiplies `a` and `b` element by element.', '/nodes/SVGs/multiply.svg', O.mul);
export const divide = binary('divide', 'Divide', 'Computes `a ÷ b` element by element.', '/nodes/SVGs/divide.svg', O.div);

export const negate = unary('negate', 'Negate', 'Math', 'Flips the sign: `−x`.', undefined, O.neg);
export const square = unary('square', 'Square', 'Math', 'Multiplies each value by itself: `x²`.', '/nodes/SVGs/square.svg', O.square);
export const sqrt = unary('sqrt', 'Square root', 'Math', '`√x` for each value (inputs should be positive).', undefined, O.sqrt);
export const exp = unary('exp', 'Exp', 'Math', '`eˣ` for each value.', undefined, O.exp);
export const log = unary('log', 'Log', 'Math', 'Natural logarithm `ln x` (inputs should be positive).', undefined, O.log);
export const sin = unary('sin', 'Sin', 'Math', 'Sine of each value (radians).', undefined, O.sin);
export const cos = unary('cos', 'Cos', 'Math', 'Cosine of each value (radians).', undefined, O.cos);

export const sum = reduction('sum', 'Sum', 'Adds values together.', undefined, O.sum);
export const mean = reduction('mean', 'Mean', 'Averages values.', '/nodes/SVGs/average.svg', O.mean);
export const max = reduction('max', 'Max', 'Keeps the largest value.', undefined, O.max);

export const relu = unary(
  'relu',
  'ReLU',
  'Activations',
  'Rectified linear unit: keeps positive values and turns negatives into 0. The most common activation in neural networks.',
  '/nodes/SVGs/relu.svg',
  O.relu,
);
export const sigmoid = unary(
  'sigmoid',
  'Sigmoid',
  'Activations',
  'Squashes any number into the range (0, 1): `1 / (1 + e⁻ˣ)`.',
  '/nodes/SVGs/sigmoidSVG.svg',
  O.sigmoid,
);
export const tanh = unary('tanh', 'Tanh', 'Activations', 'Squashes any number into the range (−1, 1).', undefined, O.tanh);
export const gelu = unary(
  'gelu',
  'GELU',
  'Activations',
  'A smooth version of ReLU used in transformers.',
  undefined,
  O.gelu,
);
