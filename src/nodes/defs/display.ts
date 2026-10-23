import { z } from 'zod';
import { defineNode } from '../types';
import { need, noParams, ports } from './helpers';

export const peek = defineNode({
  type: 'peek',
  label: 'Peek',
  category: 'Display',
  explanation: 'Shows the value flowing through it, larger. Passes the value on unchanged.',
  display: 'tensor',
  inputs: ports('x'),
  outputs: [{ name: 'out' }],
  params: noParams,
  fields: [],
  differentiable: true,
  forward: (ctx) => ({ out: need(ctx, 'x') }),
});

export const scatter = defineNode({
  type: 'scatter',
  label: 'Scatter Plot',
  category: 'Display',
  explanation: 'Plots `x` against `y` (and optionally the model’s `prediction`) as dots.',
  icon: '/nodes/SVGs/array.svg',
  display: 'scatter',
  inputs: [{ name: 'x' }, { name: 'y' }, { name: 'prediction', optional: true }],
  outputs: [],
  params: noParams,
  fields: [],
  differentiable: true,
  forward: () => ({}),
});

export const image = defineNode({
  type: 'image',
  label: 'Image',
  category: 'Display',
  explanation: 'Draws rows of pixel values as grayscale pictures (784 values → 28×28).',
  icon: '/nodes/SVGs/image.svg',
  display: 'image',
  inputs: ports('x'),
  outputs: [],
  params: z.object({ count: z.number().int().min(1).max(16).default(4) }),
  fields: [{ key: 'count', label: 'Images to show', kind: 'int', min: 1, max: 16 }],
  differentiable: true,
  forward: () => ({}),
});
