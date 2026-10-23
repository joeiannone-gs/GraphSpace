import { DocBuilder } from '@/doc/builder';
import { cloneSubtree } from '@/doc/clone';
import { newId } from '@/doc/ids';
import { connect, removeNodes } from '@/graph/ops';
import { linear, mlp } from '@/library/builtin';
import { accuracy, extend, find, pct } from '../helpers';
import type { Lesson } from '../types';

export const classifyDigits: Lesson = {
  id: 'classify-digits',
  title: 'Classify handwritten digits',
  summary: 'Turn 784 pixels into 10 scores, one per digit, and train it on real handwriting.',
  minutes: 20,
  palette: ['dataset', 'image', 'reshape', 'relu', 'softmax_cross_entropy', 'accuracy', 'argmax', 'minimize', 'peek', 'group:linear', 'group:mlp', 'group:cross_entropy', 'group:softmax'],
  starter() {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.01, steps: 100 };
    b.doc.info.description = '200 handwritten digits from the MNIST dataset. Each image is 28×28 = **784** numbers between 0 and 1.';
    const data = b.add('dataset', { source: 'mnist-200' }, { label: 'Digits', pos: [0, 0] });
    const img = b.add('image', { count: 9 }, { pos: [-1800, -1100] });
    b.wire([data, 'x'], img, 'x');
    return b.build();
  },
  steps: [
    {
      title: 'One score per digit',
      body:
        'Add a **Linear** layer with *Inputs* `784` and *Outputs* `10` (press **Rebuild**) fed by the images `x`. Its 10 outputs are scores: the biggest one is the guess. Add **Softmax Cross-Entropy** against `y`, **Minimize** it, add **Accuracy**, and train.',
      checks: [
        { kind: 'structure', describe: 'A Linear layer reads the images', test: ({ q }) => q.nodes('linear').some((g) => q.source(g.id, 'x')?.type === 'dataset') || 'Connect the images x into a Linear layer.' },
        { kind: 'structure', describe: 'Loss is minimized and accuracy measured', test: ({ q }) => (q.flows('linear', 'minimize') && q.flows('linear', 'accuracy')) || 'Linear → Softmax Cross-Entropy → Minimize, and an Accuracy node.' },
        {
          kind: 'value',
          describe: '784 inputs, 10 scores',
          test: ({ q, session }) => {
            const g = q.nodes('linear').find((n) => q.source(n.id, 'x')?.type === 'dataset');
            const v = g && session?.valueOf(g.id, 'y');
            return v?.shape[1] === 10 || 'Set Inputs to 784 and Outputs to 10, then Rebuild.';
          },
        },
        { kind: 'train', describe: 'Accuracy above 85%', steps: 60, test: (ctx) => (accuracy(ctx) ?? 0) > 0.85 || `Accuracy reached ${pct(accuracy(ctx))}.` },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const data = find(d, 'dataset').id;
          const l = b.insert(linear.build({ inFeatures: 784, outFeatures: 10 }), { pos: [0, -1100] });
          b.wire([data, 'x'], l, 'x');
          const ce = b.add('softmax_cross_entropy', {}, { pos: [0, -2200] });
          b.wire([l, 'y'], ce, 'logits');
          b.wire([data, 'y'], ce, 'targets');
          const acc = b.add('accuracy', {}, { pos: [1100, -2200] });
          b.wire([l, 'y'], acc, 'scores');
          b.wire([data, 'y'], acc, 'targets');
          const min = b.add('minimize', {}, { pos: [0, -3300] });
          b.wire(ce, min, 'loss');
        }),
    },
    {
      title: 'Go deeper',
      body:
        'Replace the single layer with an **MLP** (784 → 32 → 10): a hidden layer of 32 units with a ReLU. Rewire the loss and accuracy to its output and train again. Does accuracy go up?',
      checks: [
        { kind: 'structure', describe: 'A hidden layer with ReLU', test: ({ q }) => q.flows('relu', 'softmax_cross_entropy') || 'Use the MLP group (or Linear → ReLU → Linear) before the loss.' },
        { kind: 'train', describe: 'Accuracy above 95%', steps: 100, test: (ctx) => (accuracy(ctx) ?? 0) > 0.95 || `Accuracy reached ${pct(accuracy(ctx))}.` },
      ],
      solve: (doc) => {
        const next = structuredClone(doc);
        const old = Object.values(next.nodes).find((n) => n.source?.id === 'linear')!;
        const consumers = Object.values(next.edges).filter((e) => e.from.node === old.id);
        removeNodes(next, [old.id]);
        const net = cloneSubtree(mlp.build({ inFeatures: 784, hidden: 32, outFeatures: 10 }), null, [0, -1100]);
        Object.assign(next.nodes, net.nodes);
        Object.assign(next.edges, net.edges);
        connect(next, { id: newId(), from: { node: find(next, 'dataset').id, port: 'x' }, to: { node: net.root, port: 'x' } });
        for (const e of consumers) connect(next, { id: newId(), from: { node: net.root, port: 'y' }, to: e.to });
        return next;
      },
    },
  ],
};
