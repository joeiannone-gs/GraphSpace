import { cloneSubtree } from '@/doc/clone';
import { DocBuilder } from '@/doc/builder';
import { newId } from '@/doc/ids';
import { connect, groupNodes, removeNodes } from '@/graph/ops';
import { linear } from '@/library/builtin';
import { accuracy, extend, find, pct } from '../helpers';
import type { Lesson } from '../types';

const isLinear = (n: { source?: { id: string } }) => n.source?.id === 'linear';

export const neuronsToMlp: Lesson = {
  id: 'neurons-to-mlp',
  title: 'From a line to a neural network',
  summary: 'A single layer can only draw straight boundaries. Add a hidden layer and a ReLU to bend them.',
  minutes: 20,
  palette: ['dataset', 'relu', 'sigmoid', 'tanh', 'softmax_cross_entropy', 'accuracy', 'minimize', 'scatter', 'peek', 'group:linear', 'group:softmax', 'group:cross_entropy'],
  starter() {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.03, steps: 400 };
    b.doc.info.description = 'Two interleaved half-moons. Each point’s color is its class. Can a model learn which moon a point belongs to?';
    const data = b.add('dataset', { source: 'moons' }, { label: 'Moons', pos: [0, 0] });
    const plot = b.add('scatter', {}, { pos: [-1800, -1100] });
    b.wire([data, 'x'], plot, 'x');
    b.wire([data, 'y'], plot, 'y');
    return b.build();
  },
  steps: [
    {
      title: 'A one-layer classifier',
      body:
        'Drag a **Linear** layer onto the canvas, set its *Outputs* to `2` (one score per class) and press **Rebuild**. Feed it the data’s `x`. Then add **Softmax Cross-Entropy** (scores vs the data’s `y`), a **Minimize** for that loss, and an **Accuracy** node to watch progress. Train.',
      hint: 'Accuracy needs the same two inputs as the loss: the scores and y.',
      checks: [
        { kind: 'structure', describe: 'A Linear layer reads x', test: ({ q }) => q.nodes(isLinear).some((g) => q.source(g.id, 'x')?.type === 'dataset') || 'Connect the data’s x into a Linear layer.' },
        { kind: 'structure', describe: 'Cross-entropy loss is minimized', test: ({ q }) => (q.flows('linear', 'softmax_cross_entropy') && q.flows('softmax_cross_entropy', 'minimize')) || 'Linear → Softmax Cross-Entropy → Minimize.' },
        { kind: 'structure', describe: 'Accuracy is measured', test: ({ q }) => q.flows('linear', 'accuracy') || 'Connect the scores and y into an Accuracy node.' },
        {
          kind: 'value',
          describe: 'Two scores per point',
          test: ({ q, session }) => {
            const g = q.nodes(isLinear).find((n) => q.source(n.id, 'x')?.type === 'dataset');
            return (g && session?.valueOf(g.id, 'y')?.shape[1] === 2) || 'Set the Linear layer’s Outputs to 2 and press Rebuild.';
          },
        },
        { kind: 'train', describe: 'Accuracy above 80%', steps: 300, test: (ctx) => (accuracy(ctx) ?? 0) > 0.8 || `Accuracy reached ${pct(accuracy(ctx))}.` },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const data = find(d, 'dataset').id;
          const l = b.insert(linear.build({ inFeatures: 2, outFeatures: 2 }), { pos: [0, -1100] });
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
      title: 'Add a hidden layer',
      body:
        'A straight line can’t follow the moons. Make the first Linear layer wider (*Outputs* `16`), add a **ReLU** after it, and a second **Linear** (`16` → `2`) that produces the scores. ReLU lets the network bend its boundary.',
      hint: 'Reconnect the loss and accuracy to the second Linear layer’s output.',
      checks: [
        { kind: 'structure', describe: 'Linear → ReLU → Linear', test: ({ q }) => (q.flows('linear', 'relu') && q.flows('relu', 'softmax_cross_entropy')) || 'Put a ReLU between two Linear layers, before the loss.' },
        { kind: 'train', describe: 'Accuracy above 95%', steps: 400, test: (ctx) => (accuracy(ctx) ?? 0) > 0.95 || `Accuracy reached ${pct(accuracy(ctx))}. Is the hidden layer wide enough?` },
      ],
      solve: (doc) => {
        const next = structuredClone(doc);
        const old = Object.values(next.nodes).find(isLinear)!;
        const data = find(next, 'dataset').id;
        const consumers = Object.values(next.edges).filter((e) => e.from.node === old.id);
        removeNodes(next, [old.id]);
        const l1 = cloneSubtree(linear.build({ inFeatures: 2, outFeatures: 16 }), null, [0, -1100]);
        const l2 = cloneSubtree(linear.build({ inFeatures: 16, outFeatures: 2 }), null, [0, -3300]);
        Object.assign(next.nodes, l1.nodes, l2.nodes);
        Object.assign(next.edges, l1.edges, l2.edges);
        next.nodes[l1.root].label = 'hidden';
        next.nodes[l2.root].label = 'scores';
        const relu = newId();
        next.nodes[relu] = { id: relu, type: 'relu', parent: null, pos: [0, -2200], params: {} };
        connect(next, { id: newId(), from: { node: data, port: 'x' }, to: { node: l1.root, port: 'x' } });
        connect(next, { id: newId(), from: { node: l1.root, port: 'y' }, to: { node: relu, port: 'x' } });
        connect(next, { id: newId(), from: { node: relu, port: 'out' }, to: { node: l2.root, port: 'x' } });
        for (const e of consumers) connect(next, { id: newId(), from: { node: l2.root, port: 'y' }, to: e.to });
        for (const n of Object.values(next.nodes)) if (n.parent === null && n.pos[1] <= -2200 && n.id !== relu && n.id !== l2.root) n.pos = [n.pos[0], n.pos[1] - 2200];
        return next;
      },
    },
    {
      title: 'Package it as a node',
      body:
        'Your network is three nodes. Select both Linear layers and the ReLU (Shift-click each), press **Ctrl+G** to group them, and give the group a name in the Info panel. Double-click it to step inside; press **Esc** to come back out. Signed in? Use **Save as node** to reuse it in other projects.',
      checks: [
        {
          kind: 'structure',
          describe: 'A group holds the ReLU',
          test: ({ q, doc }) =>
            q.nodes((n) => n.type === 'composite' && !n.source).some((g) => Object.values(doc.nodes).some((n) => n.type === 'relu' && q.inside(n.id, g.id))) ||
            'Select the two Linear layers and the ReLU, then press Ctrl+G.',
        },
        { kind: 'train', describe: 'It still learns', steps: 400, test: (ctx) => (accuracy(ctx) ?? 0) > 0.95 || `Accuracy reached ${pct(accuracy(ctx))}.` },
      ],
      solve: (doc) => {
        const next = structuredClone(doc);
        const ids = Object.values(next.nodes)
          .filter((n) => n.parent === null && (isLinear(n) || n.type === 'relu'))
          .map((n) => n.id);
        groupNodes(next, ids, newId(), 'My network');
        return next;
      },
    },
  ],
};
