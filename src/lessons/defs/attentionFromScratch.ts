import { DocBuilder } from '@/doc/builder';
import { newId } from '@/doc/ids';
import { CORPORA, vocabOf } from '@/engine/text';
import { connect } from '@/graph/ops';
import { attention, linear } from '@/library/builtin';
import { extend, find } from '../helpers';
import type { CheckContext, Lesson } from '../types';

const V = vocabOf(CORPORA.counting.text).chars.length;
const isLinear = (n: { source?: { id: string } }) => n.source?.id === 'linear';

function lossBelow(limit: number, hint: string) {
  return (ctx: CheckContext) => {
    const loss = ctx.session?.currentLoss;
    return (loss !== null && loss !== undefined && loss < limit) || `The loss reached ${loss?.toFixed(2)} (goal: below ${limit}). ${hint}`;
  };
}

export const attentionFromScratch: Lesson = {
  id: 'attention',
  title: 'Attention: predicting the next character',
  summary: 'Turn characters into vectors, predict what comes next, then let each position look back at earlier ones, the core idea of transformers.',
  minutes: 25,
  palette: [
    'text_data',
    'parameter',
    'embedding',
    'add',
    'multiply',
    'value',
    'matmul',
    'transpose',
    'causal_mask',
    'softmax_cross_entropy',
    'minimize',
    'sample',
    'peek',
    'group:linear',
    'group:softmax',
    'group:attention',
    'group:multi_head_attention',
    'group:layer_norm',
    'group:feed_forward',
    'group:transformer_block',
  ],
  starter() {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.02, steps: 400 };
    b.doc.generate = { steps: 80 };
    b.doc.info.description = `The text is “one two three … ten.” repeated. It uses **${V}** different characters, so each character is a number from 0 to ${V - 1}.`;
    b.add('text_data', { source: 'counting', context: 8, batchSize: 8, prompt: 'one tw' }, { label: 'Text', pos: [0, 0] });
    return b.build();
  },
  steps: [
    {
      title: 'Characters as vectors',
      body: `Numbers like 7 say nothing about a character. Give each one a learnable vector instead: add a **Parameter** with shape \`${V}, 16\` (one row of 16 numbers per character) and an **Embedding** node that looks up the rows for the text’s \`x\`.`,
      checks: [
        {
          kind: 'structure',
          describe: 'An Embedding reads the text with a Parameter table',
          test: ({ q }) =>
            q.nodes('embedding').some((n) => q.source(n.id, 'table')?.type === 'parameter' && q.source(n.id, 'ids')?.type === 'text_data') ||
            'Connect a Parameter into `table` and the text’s x into `ids`.',
        },
        {
          kind: 'value',
          describe: 'Every character becomes 16 numbers',
          test: ({ q, session }) => {
            const e = q.nodes('embedding')[0];
            const v = e && session?.valueOf(e.id);
            return (v?.shape.length === 3 && v.shape[2] === 16) || `The table should have shape ${V}, 16.`;
          },
        },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const table = b.add('parameter', { shape: [V, 16], init: 'normal', scale: 0.1 }, { label: 'character vectors', pos: [1100, 0] });
          const emb = b.add('embedding', {}, { pos: [500, -1100] });
          b.wire(table, emb, 'table');
          b.wire([find(d, 'text_data').id, 'x'], emb, 'ids');
        }),
    },
    {
      title: 'Guess the next character',
      body: `Add a **Linear** layer that turns each 16-number vector into ${V} scores (Inputs \`16\`, Outputs \`${V}\`, then **Rebuild**). Compare the scores with the text’s \`y\` (the next characters) using **Softmax Cross-Entropy**, **Minimize** it and train. Each position only sees its own character, so the loss gets stuck around 1.`,
      checks: [
        { kind: 'structure', describe: 'Embedding → Linear → Cross-Entropy → Minimize', test: ({ q }) => (q.flows('embedding', 'linear') && q.flows('linear', 'minimize')) || 'Connect them in this order.' },
        { kind: 'train', describe: 'Loss below 1.5', steps: 200, test: lossBelow(1.5, 'Check the Linear sizes.') },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const head = b.insert(linear.build({ inFeatures: 16, outFeatures: V }), { label: 'scores', pos: [500, -3300] });
          b.wire(find(d, 'embedding').id, head, 'x');
          const ce = b.add('softmax_cross_entropy', {}, { pos: [500, -4400] });
          b.wire([head, 'y'], ce, 'logits');
          b.wire([find(d, 'text_data').id, 'y'], ce, 'targets');
          const min = b.add('minimize', {}, { pos: [500, -5500] });
          b.wire(ce, min, 'loss');
        }),
    },
    {
      title: 'Look back with attention',
      body:
        'After “t” comes “w”, “h” or “e”: you need to look further back. Add a second Parameter of shape `8, 16` (one vector per *position*) and **Add** it to the embeddings, so the model knows where each character is. Then put an **Attention** group (16 → 16) between that and the Linear layer. Open Attention to see queries, keys, values, the causal mask and the softmax. Train again.',
      hint: 'Dragging a new wire into the Linear layer’s input replaces the old one.',
      checks: [
        { kind: 'structure', describe: 'Position vectors are added', test: ({ q }) => q.nodes('add').some((n) => [q.source(n.id, 'a')?.type, q.source(n.id, 'b')?.type].includes('embedding')) || 'Add a [8, 16] Parameter to the embeddings.' },
        { kind: 'structure', describe: 'Attention feeds the scores', test: ({ q }) => q.flows('attention', 'linear') || 'Put the Attention group before the Linear layer.' },
        { kind: 'train', describe: 'Loss below 0.85', steps: 400, test: lossBelow(0.85, 'Is the Attention group getting the embeddings plus positions?') },
      ],
      solve: (doc) => {
        const next = extend(doc, (b, d) => {
          const pos = b.add('parameter', { shape: [8, 16], init: 'normal', scale: 0.1 }, { label: 'position vectors', pos: [-700, -1100] });
          const sum = b.add('add', {}, { label: 'input', pos: [0, -2000] });
          b.wire(find(d, 'embedding').id, sum, 'a');
          b.wire(pos, sum, 'b');
          const att = b.insert(attention.build({ dModel: 16, dHead: 16 }), { pos: [-900, -2900] });
          b.wire(sum, att, 'x');
        });
        const att = Object.values(next.nodes).find((n) => n.source?.id === 'attention' && n.parent === null)!;
        const head = Object.values(next.nodes).find((n) => isLinear(n) && n.parent === null)!;
        connect(next, { id: newId(), from: { node: att.id, port: 'y' }, to: { node: head.id, port: 'x' } });
        return next;
      },
    },
    {
      title: 'Let it write',
      body:
        'Add a **Sample** node fed by the scores, and connect Sample’s output back into the Text node’s `next` input. It becomes a dashed orange *feedback* connection: each generated character is appended to the text and used to predict the next. Train, then press **Generate**.',
      checks: [
        {
          kind: 'structure',
          describe: 'Sample feeds back into the text',
          test: ({ doc }) =>
            Object.values(doc.edges).some((e) => e.kind === 'feedback' && doc.nodes[e.from.node]?.type === 'sample' && doc.nodes[e.to.node]?.type === 'text_data') ||
            'Connect Sample’s output into the Text node’s `next` input.',
        },
        { kind: 'structure', describe: 'Sample reads the scores', test: ({ q }) => q.flows('linear', 'sample') || 'Feed the Linear layer’s scores into Sample.' },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const head = Object.values(d.nodes).find((n) => isLinear(n) && n.parent === null)!;
          const sample = b.add('sample', { temperature: 0.7 }, { pos: [1600, -4400] });
          b.wire([head.id, 'y'], sample, 'logits');
          b.wire(sample, find(d, 'text_data').id, 'next', 'feedback');
        }),
    },
  ],
};
