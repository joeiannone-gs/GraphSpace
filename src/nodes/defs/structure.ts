import { z } from 'zod';
import { defineNode } from '../types';
import { noParams } from './helpers';

/** A group of nodes that acts as one node. Its ports come from the Input/Output nodes inside it. */
export const composite = defineNode({
  type: 'composite',
  label: 'Group',
  category: 'Structure',
  explanation: 'A group of nodes that acts like a single node. Double-click to open it; its ports are the Input and Output nodes inside.',
  display: 'none',
  inputs: [],
  outputs: [],
  params: noParams,
  fields: [],
  differentiable: true,
  hidden: true,
});

const boundaryParams = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,30}$/).default('x'),
  order: z.number().int().default(0),
});

export const input = defineNode({
  type: 'input',
  label: 'Input',
  category: 'Structure',
  explanation: 'An input port of the group it sits in. Whatever connects to that port outside flows out of here.',
  display: 'none',
  inputs: [],
  outputs: [{ name: 'out' }],
  params: boundaryParams,
  fields: [
    { key: 'name', label: 'Port name', kind: 'text' },
    { key: 'order', label: 'Order', kind: 'int' },
  ],
  differentiable: true,
});

export const output = defineNode({
  type: 'output',
  label: 'Output',
  category: 'Structure',
  explanation: 'An output port of the group it sits in. Whatever connects here comes out of that port outside.',
  display: 'none',
  inputs: [{ name: 'in' }],
  outputs: [],
  params: boundaryParams.extend({ name: boundaryParams.shape.name.default('out') }),
  fields: [
    { key: 'name', label: 'Port name', kind: 'text' },
    { key: 'order', label: 'Order', kind: 'int' },
  ],
  differentiable: true,
});
