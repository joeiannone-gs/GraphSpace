import { z } from 'zod';
import { fromNested, tensor } from '@/engine/tensor';
import { tensorJSONSchema } from '@/doc/schema';
import { defineNode, type DatasetParams, type ParameterParams } from '../types';
import { out } from './helpers';

export const DATASET_SOURCES = [
  { value: 'points-2d', label: '2-D points (1000, linear trend)' },
  { value: 'xor', label: 'XOR (4 points)' },
  { value: 'moons', label: 'Two moons (400)' },
  { value: 'spiral', label: 'Spiral, 3 classes (300)' },
  { value: 'mnist-200', label: 'MNIST digits (200 images)' },
  { value: 'csv', label: 'My own table (CSV, below)' },
];

export const value = defineNode({
  type: 'value',
  label: 'Value',
  category: 'Data',
  explanation: 'A fixed number, vector or matrix. Type a number like `3` or an array like `[[1, 2], [3, 4]]`.',
  icon: '/nodes/SVGs/val.svg',
  display: 'value',
  inputs: [],
  outputs: out,
  params: z.object({ value: tensorJSONSchema.default({ shape: [], data: [1] }) }),
  fields: [{ key: 'value', label: 'Value', kind: 'tensor' }],
  differentiable: true,
  forward: ({ tape, p }) => ({ out: tape.constant(tensor(p.value.shape, p.value.data)) }),
});

export const parameter = defineNode({
  type: 'parameter',
  label: 'Parameter',
  category: 'Data',
  explanation:
    'A tensor that **training changes** to make the loss smaller. Its shape is fixed; its starting values come from the chosen initializer (or from saved trained values).',
  icon: '/nodes/SVGs/param.svg',
  display: 'parameter',
  inputs: [],
  outputs: out,
  params: z.object({
    shape: z.array(z.number().int().min(1)).max(4).default([1]),
    init: z.enum(['zeros', 'ones', 'normal', 'uniform', 'glorot']).default('normal'),
    scale: z.number().default(0.1),
    trainable: z.boolean().default(true),
    value: tensorJSONSchema.optional(),
  }) satisfies z.ZodType<ParameterParams>,
  fields: [
    { key: 'shape', label: 'Shape', kind: 'shape', help: 'For example `2, 3` for a 2×3 matrix.' },
    {
      key: 'init',
      label: 'Initial values',
      kind: 'select',
      options: [
        { value: 'normal', label: 'Random normal × scale' },
        { value: 'uniform', label: 'Random uniform ±scale' },
        { value: 'glorot', label: 'Glorot (good for layers)' },
        { value: 'zeros', label: 'Zeros' },
        { value: 'ones', label: 'Ones' },
      ],
    },
    { key: 'scale', label: 'Scale', kind: 'number', step: 0.01 },
    { key: 'trainable', label: 'Trainable', kind: 'bool' },
  ],
  differentiable: true,
  forward: ({ nodeId, p, env }) => ({ out: env.parameter(nodeId, p) }),
});

export const dataset = defineNode({
  type: 'dataset',
  label: 'Dataset',
  category: 'Data',
  explanation:
    'Examples to learn from. `x` is the input and `y` the answer for each example. While training, each step takes the next batch.',
  icon: '/nodes/SVGs/dropIcon.svg',
  display: 'dataset',
  inputs: [],
  outputs: [
    { name: 'x', doc: 'inputs' },
    { name: 'y', doc: 'targets' },
  ],
  params: z.object({
    source: z.string().default('points-2d'),
    batchSize: z.number().int().min(0).default(0),
    shuffle: z.boolean().default(true),
    split: z.enum(['train', 'test']).default('train'),
    csv: z.string().max(200_000).default(''),
    yColumns: z.number().int().min(0).max(20).default(1),
    classes: z.boolean().default(false),
  }) satisfies z.ZodType<DatasetParams>,
  fields: [
    { key: 'source', label: 'Data', kind: 'select', options: DATASET_SOURCES },
    { key: 'csv', label: 'My table (CSV)', kind: 'longtext', help: 'Numbers separated by commas, one example per row. A header row is fine.' },
    { key: 'yColumns', label: 'Answer columns (y)', kind: 'int', min: 0, max: 20, help: 'How many columns on the right are the answers.' },
    { key: 'classes', label: 'Answers are classes (0, 1, 2…)', kind: 'bool' },
    { key: 'batchSize', label: 'Batch size', kind: 'int', min: 0, help: '0 uses every example each step.' },
    { key: 'shuffle', label: 'Shuffle', kind: 'bool' },
    {
      key: 'split',
      label: 'Split',
      kind: 'select',
      options: [
        { value: 'train', label: 'Training examples' },
        { value: 'test', label: 'Held-out test examples' },
      ],
    },
  ],
  differentiable: true,
  forward: ({ tape, nodeId, p, env }) => {
    const { x, y } = env.batch(nodeId, p);
    return { x: tape.constant(x), y: tape.constant(y) };
  },
});

export const previous = defineNode({
  type: 'previous',
  label: 'Previous Value',
  category: 'Data',
  explanation:
    'Memory between steps. Connect a **feedback** edge into it: each step it outputs what arrived on the previous step (or its starting value on the first step). Use it to build loops such as text generation.',
  display: 'value',
  inputs: [{ name: 'x', feedback: true, optional: true, doc: 'feedback: value from the previous step' }],
  outputs: out,
  params: z.object({ initial: tensorJSONSchema.default({ shape: [], data: [0] }) }),
  fields: [{ key: 'initial', label: 'Starting value', kind: 'tensor' }],
  differentiable: false,
  forward: ({ tape, p, in: inputs }) => ({
    out: inputs.x ?? tape.constant(tensor(p.initial.shape, p.initial.data)),
  }),
});

/** Parse a learner-typed tensor like `3` or `[[1,2],[3,4]]`. */
export function parseTensorText(text: string) {
  const parsed: unknown = JSON.parse(text);
  const t = fromNested(parsed as never);
  return { shape: [...t.shape], data: Array.from(t.data) };
}
