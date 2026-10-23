import { DocBuilder } from '@/doc/builder';
import { mse } from '@/library/builtin';
import { connect, removeNodes } from '@/graph/ops';
import { newId } from '@/doc/ids';
import { extend, find, scalarOf } from '../helpers';
import type { Lesson } from '../types';

export const fitALineLesson: Lesson = {
  id: 'fit-a-line',
  title: 'Fit a line',
  summary: 'Your first model: predict y from x with a slope and an offset, measure the error, and let training fix it.',
  minutes: 15,
  palette: ['value', 'parameter', 'dataset', 'add', 'subtract', 'multiply', 'square', 'mean', 'matmul', 'minimize', 'scatter', 'peek', 'group:mse'],
  starter() {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.05, steps: 300 };
    b.doc.info.description = 'Each point has an input **x** and an answer **y**. Can a straight line predict y from x?';
    const data = b.add('dataset', { source: 'points-2d' }, { label: 'Points', pos: [0, 0] });
    const plot = b.add('scatter', {}, { pos: [1800, -2200] });
    b.wire([data, 'x'], plot, 'x');
    b.wire([data, 'y'], plot, 'y');
    return b.build();
  },
  steps: [
    {
      title: 'Make a prediction',
      body:
        'A line is `x · w + b`. Add a **Parameter** (shape `1, 1`) and label it **w**, then a **MatMul** of the data’s `x` and **w**. Add another Parameter **b** (shape `1`) and an **Add** of the MatMul and b. Finally connect the Add into the Scatter Plot’s `prediction` input: the orange dots are your model’s guesses.',
      hint: 'Parameters start random; that’s fine. Training will fix them later.',
      checks: [
        {
          kind: 'structure',
          describe: 'x goes through a MatMul with a Parameter',
          test: ({ q }) =>
            q.nodes('matmul').some((n) => q.source(n.id, 'a')?.type === 'dataset' && q.source(n.id, 'b')?.type === 'parameter') ||
            'Connect the data’s x to MatMul input a and a Parameter to input b.',
        },
        {
          kind: 'structure',
          describe: 'A bias Parameter is added',
          test: ({ q }) =>
            q.nodes('add').some((n) => {
              const srcs = [q.source(n.id, 'a')?.type, q.source(n.id, 'b')?.type];
              return srcs.includes('matmul') && srcs.includes('parameter');
            }) || 'Add the MatMul result and a second Parameter.',
        },
        {
          kind: 'structure',
          describe: 'The prediction is plotted',
          test: ({ q }) => q.nodes('scatter').some((n) => q.source(n.id, 'prediction')?.type === 'add') || 'Connect the Add into the Scatter Plot’s prediction input.',
        },
        {
          kind: 'value',
          describe: 'One prediction per point',
          test: ({ q, session }) => {
            const add = q.nodes('scatter').map((n) => q.source(n.id, 'prediction')).find(Boolean);
            const v = add && session?.valueOf(add.id);
            return (v?.shape.length === 2 && v.shape[1] === 1) || 'The prediction should have one column. Check the shapes of w (1, 1) and b (1).';
          },
        },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const data = find(d, 'dataset').id;
          const w = b.add('parameter', { shape: [1, 1] }, { label: 'w', pos: [900, -1100] });
          const bias = b.add('parameter', { shape: [1], init: 'zeros' }, { label: 'b', pos: [1800, -1100] });
          const mm = b.add('matmul', {}, { pos: [450, -2200] });
          b.wire([data, 'x'], mm, 'a');
          b.wire(w, mm, 'b');
          const pred = b.add('add', {}, { label: 'prediction', pos: [900, -3300] });
          b.wire(mm, pred, 'a');
          b.wire(bias, pred, 'b');
          b.wire(pred, find(d, 'scatter').id, 'prediction');
        }),
    },
    {
      title: 'Measure the error',
      body:
        'How wrong is the line? **Subtract** the answers `y` from the prediction, **Square** the differences (so negatives count too), and take the **Mean**. That single number is the *mean squared error*.',
      checks: [
        { kind: 'structure', describe: 'prediction − y', test: ({ q }) => q.nodes('subtract').some((n) => q.source(n.id, 'a')?.type === 'add' && q.source(n.id, 'b')?.type === 'dataset') || 'Subtract with a = prediction and b = the data’s y.' },
        { kind: 'structure', describe: 'Squared, then averaged', test: ({ q }) => (q.flows('subtract', 'square') && q.flows('square', 'mean')) || 'Subtract → Square → Mean.' },
        {
          kind: 'value',
          describe: 'The error is one number',
          test: ({ q, session }) => q.nodes('mean').some((n) => session?.valueOf(n.id)?.data.length === 1) || 'Leave Mean’s axes empty so it averages everything.',
        },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const diff = b.add('subtract', {}, { pos: [900, -4400] });
          b.wire(find(d, 'prediction').id, diff, 'a');
          b.wire([find(d, 'dataset').id, 'y'], diff, 'b');
          const sq = b.add('square', {}, { pos: [900, -5500] });
          b.wire(diff, sq, 'x');
          const mean = b.add('mean', {}, { label: 'error', pos: [900, -6600] });
          b.wire(sq, mean, 'x');
        }),
    },
    {
      title: 'Train it',
      body:
        'Add a **Minimize** node and connect the error into it. Now press **Train**: each step nudges w and b downhill on the error. Watch the orange predictions line up with the data, and the cyan glow show which connections carry the biggest gradients.',
      checks: [
        { kind: 'structure', describe: 'The error is minimized', test: ({ q }) => q.nodes('minimize').some((n) => q.source(n.id, 'loss')?.type === 'mean') || 'Connect the Mean into a Minimize node.' },
        {
          kind: 'train',
          describe: 'After training the error is below 0.15',
          steps: 300,
          test: (ctx) => {
            const loss = ctx.session?.currentLoss;
            return (loss !== null && loss !== undefined && loss < 0.15) || `The error only got down to ${loss?.toFixed(3)}. Try a learning rate around 0.05.`;
          },
        },
        {
          kind: 'train',
          describe: 'The slope w is about 0.7',
          steps: 300,
          test: (ctx) => {
            const w = ctx.q.nodes('matmul').map((n) => ctx.q.source(n.id, 'b')).find((n) => n?.type === 'parameter');
            const v = w && scalarOf(ctx, w.id);
            return (v !== undefined && Math.abs(v - 0.7) < 0.15) || `w ended at ${v?.toFixed(2)}.`;
          },
        },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const min = b.add('minimize', {}, { pos: [900, -7700] });
          b.wire(find(d, 'error').id, min, 'loss');
        }),
    },
    {
      title: 'Use the built-in MSE',
      body:
        'Subtract → Square → Mean is so common it comes ready-made. Drag the **MSE** group from *Layers & losses*, connect `prediction` and `y`, and feed it to Minimize instead (connecting replaces the old wire). Double-click MSE to look inside: it’s the same three nodes.',
      checks: [
        {
          kind: 'structure',
          describe: 'The MSE group gets the prediction and y',
          test: ({ q }) =>
            q.nodes('mse').some((g) => q.source(g.id, 'prediction')?.type === 'add' && q.source(g.id, 'target')?.type === 'dataset') ||
            'Connect prediction and the data’s y into the MSE group.',
        },
        { kind: 'structure', describe: 'Minimize uses the MSE', test: ({ q }) => q.flows('mse', 'minimize') || 'Connect the MSE output into Minimize.' },
      ],
      solve: (doc) => {
        const next = extend(doc, (b, d) => {
          const g = b.insert(mse.build({}), { pos: [-900, -5500] });
          b.wire(find(d, 'prediction').id, g, 'prediction');
          b.wire([find(d, 'dataset').id, 'y'], g, 'target');
        });
        const group = Object.values(next.nodes).find((n) => n.source?.id === 'mse')!;
        connect(next, { id: newId(), from: { node: group.id, port: 'loss' }, to: { node: find(next, 'minimize').id, port: 'loss' } });
        removeNodes(next, [find(next, 'error').id]);
        return next;
      },
    },
  ],
};
