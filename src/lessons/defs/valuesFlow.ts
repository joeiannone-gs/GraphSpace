import { DocBuilder } from '@/doc/builder';
import { setParams } from '@/graph/ops';
import { extend, find } from '../helpers';
import type { Lesson } from '../types';

export const valuesFlow: Lesson = {
  id: 'values-flow',
  title: 'Values flow through a graph',
  summary: 'Connect nodes to compute with numbers, then with whole arrays at once.',
  minutes: 5,
  palette: ['value', 'add', 'subtract', 'multiply', 'divide', 'square', 'peek'],
  starter() {
    const b = new DocBuilder();
    b.doc.info.description = 'A graph is a recipe: values flow along the green connections and each node does one small calculation.';
    b.add('value', { value: { shape: [], data: [3] } }, { label: 'a', pos: [-600, 0] });
    b.add('value', { value: { shape: [], data: [4] } }, { label: 'b', pos: [600, 0] });
    return b.build();
  },
  steps: [
    {
      title: 'Add two numbers',
      body: 'Drag an **Add** node from the HUB onto the canvas. Connect **a** to its `a` input and **b** to its `b` input: drag from the green dot on top of a Value to a green dot on the bottom of Add. The Add node shows the result.',
      hint: 'Outputs are on the top of a node and inputs on the bottom. Drop the wire on the input dot.',
      checks: [
        {
          kind: 'structure',
          describe: 'An Add node gets both values',
          test: ({ q }) =>
            q.nodes('add').some((n) => q.source(n.id, 'a')?.type === 'value' && q.source(n.id, 'b')?.type === 'value') ||
            'Connect a and b into the two inputs of an Add node.',
        },
        {
          kind: 'value',
          describe: 'The sum is 7',
          test: ({ q, session }) => q.nodes('add').some((n) => session?.valueOf(n.id)?.data[0] === 7) || 'The Add node should show 7.',
        },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const add = b.add('add', {}, { pos: [0, -1100] });
          b.wire(find(d, 'a').id, add, 'a');
          b.wire(find(d, 'b').id, add, 'b');
        }),
    },
    {
      title: 'Multiply the result',
      body: 'Make the graph compute **(3 + 4) × 2**: add a **Value** node, click it, and type `2` in the Info panel. Then add a **Multiply** node fed by the sum and the 2.',
      checks: [
        {
          kind: 'structure',
          describe: 'A Multiply node uses the sum',
          test: ({ q }) => q.flows('add', 'multiply') || 'Connect the Add node into a Multiply node.',
        },
        {
          kind: 'value',
          describe: 'The product is 14',
          test: ({ q, session }) => q.nodes('multiply').some((n) => session?.valueOf(n.id)?.data[0] === 14) || 'Multiply should show 14.',
        },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const two = b.add('value', { value: { shape: [], data: [2] } }, { label: 'two', pos: [900, -1100] });
          const mul = b.add('multiply', {}, { pos: [300, -2200] });
          b.wire(find(d, 'add').id, mul, 'a');
          b.wire(two, mul, 'b');
        }),
    },
    {
      title: 'Many numbers at once',
      body: 'Click **a** and change its value to `[1, 2, 3]`. Every node now works on three numbers at once. **b** is a single number, so it is *broadcast*: reused for each of the three.',
      checks: [
        {
          kind: 'value',
          describe: 'The sum is [5, 6, 7]',
          test: ({ q, session }) =>
            q.nodes('add').some((n) => {
              const v = session?.valueOf(n.id);
              return v?.shape.length === 1 && [...v.data].join() === '5,6,7';
            }) || 'Set a to [1, 2, 3] so the sum becomes [5, 6, 7].',
        },
        {
          kind: 'value',
          describe: 'The product is [10, 12, 14]',
          test: ({ q, session }) => q.nodes('multiply').some((n) => [...(session?.valueOf(n.id)?.data ?? [])].join() === '10,12,14'),
        },
      ],
      solve: (doc) => {
        const next = structuredClone(doc);
        setParams(next, find(next, 'a').id, { value: { shape: [3], data: [1, 2, 3] } });
        return next;
      },
    },
  ],
};
