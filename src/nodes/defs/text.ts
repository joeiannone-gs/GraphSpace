import { z } from 'zod';
import * as O from '@/engine/ops';
import { CORPORA, corpusText, decode, encode, textBatch, vocabOf, type Vocab } from '@/engine/text';
import { ShapeError, shapeStr, tensor } from '@/engine/tensor';
import { defineNode } from '../types';
import { need, out } from './helpers';

interface TextState {
  key: string;
  vocab: Vocab;
  ids: number[];
  /** Shown on the node: a sample window, or the generated text. */
  text: string;
  context: number[];
}

export const textData = defineNode({
  type: 'text_data',
  label: 'Text Data',
  category: 'Text',
  explanation:
    'Characters as numbers. Each distinct character gets an id (the *vocabulary*). `x` is a batch of windows of text and `y` the same windows shifted by one character: the next character to predict. While generating, a **feedback** connection into `next` appends each new character to the text, starting from the prompt.',
  display: 'text',
  inputs: [{ name: 'next', feedback: true, optional: true, doc: 'feedback: the next character id while generating' }],
  outputs: [
    { name: 'x', doc: 'character ids [batch, context]' },
    { name: 'y', doc: 'next-character ids [batch, context]' },
  ],
  params: z.object({
    source: z.string().default('sonnets'),
    custom: z.string().max(20_000).default(''),
    context: z.number().int().min(2).max(64).default(16),
    batchSize: z.number().int().min(1).max(64).default(8),
    prompt: z.string().max(200).default('Shall I '),
  }),
  fields: [
    {
      key: 'source',
      label: 'Text',
      kind: 'select',
      options: [...Object.entries(CORPORA).map(([value, c]) => ({ value, label: c.label })), { value: 'custom', label: 'My own text (below)' }],
    },
    { key: 'custom', label: 'My own text', kind: 'text' },
    { key: 'context', label: 'Context length', kind: 'int', min: 2, max: 64, help: 'How many characters the model sees at once.' },
    { key: 'batchSize', label: 'Batch size', kind: 'int', min: 1, max: 64 },
    { key: 'prompt', label: 'Prompt for generating', kind: 'text' },
  ],
  differentiable: false,
  forward: ({ tape, nodeId, p, env, in: inputs }) => {
    const source = corpusText(p.source, p.custom);
    const st = env.state<TextState>(nodeId, () => ({ key: '', vocab: vocabOf(''), ids: [], text: '', context: [] }));
    if (st.key !== source) {
      st.key = source;
      st.vocab = vocabOf(source);
      st.ids = encode(st.vocab, source);
    }
    const T = p.context;
    if (env.mode === 'generate') {
      if (env.iter === 0) {
        const prompt = [...p.prompt].filter((ch) => st.vocab.index.has(ch)).join('') || source.slice(0, 1);
        st.context = encode(st.vocab, prompt);
        st.text = prompt;
      } else if (inputs.next) {
        const id = Math.round(inputs.next.value.data[0]);
        st.context.push(id);
        st.text += st.vocab.chars[id] ?? '';
      }
      const pad = st.vocab.index.get(' ') ?? 0;
      const window = st.context.slice(-T);
      const ids = [...Array(T - window.length).fill(pad), ...window];
      return { x: tape.constant(tensor([1, T], ids)), y: tape.constant(tensor([1, T])) };
    }
    const batch = textBatch(st.ids, T, p.batchSize, env.mode === 'train' ? env.rng : null);
    st.text = decode(st.vocab, batch.x.data.subarray(0, T));
    return { x: tape.constant(batch.x), y: tape.constant(batch.y) };
  },
});

export const embedding = defineNode({
  type: 'embedding',
  label: 'Embedding',
  category: 'Text',
  explanation:
    'Looks up a row of `table` for each id: character ids [batch, context] become vectors [batch, context, size]. The table is a Parameter of shape [vocabulary size, size], so training learns what each character “means”.',
  display: 'tensor',
  inputs: [
    { name: 'table', doc: 'Parameter [vocab, size]' },
    { name: 'ids', doc: 'integer ids' },
  ],
  outputs: out,
  params: z.object({}),
  fields: [],
  differentiable: true,
  forward: (ctx) => ({ out: O.gather(ctx.tape, need(ctx, 'table'), need(ctx, 'ids')) }),
});

export const sample = defineNode({
  type: 'sample',
  label: 'Sample',
  category: 'Text',
  explanation:
    'Picks the next character from the model’s scores at the **last** position: softmax with a *temperature* (lower = safer choices, higher = more surprising), then a random draw. Connect it back into Text Data’s `next` input with a feedback connection and press **Generate**.',
  display: 'tensor',
  inputs: [{ name: 'logits', doc: 'scores [..., vocab]' }],
  outputs: out,
  params: z.object({ temperature: z.number().min(0.05).max(5).default(0.8), greedy: z.boolean().default(false) }),
  fields: [
    { key: 'temperature', label: 'Temperature', kind: 'number', step: 0.1 },
    { key: 'greedy', label: 'Always pick the top score', kind: 'bool' },
  ],
  differentiable: false,
  forward: (ctx) => {
    const logits = need(ctx, 'logits').value;
    const V = logits.shape[logits.shape.length - 1];
    if (!V) throw new ShapeError(`Sample needs scores with a last axis, got ${shapeStr(logits.shape)}`);
    // [batch, time, V]: the first sequence's last position. [time, V]: the last row. [V]: itself.
    const rows = logits.data.length / V;
    const offset = (logits.shape.length >= 3 ? logits.shape[logits.shape.length - 2] - 1 : rows - 1) * V;
    const row = logits.data.subarray(offset, offset + V);
    let pick = 0;
    if (ctx.p.greedy) {
      for (let i = 1; i < V; i++) if (row[i] > row[pick]) pick = i;
    } else {
      const max = Math.max(...row);
      const w = Array.from(row, (v) => Math.exp((v - max) / ctx.p.temperature));
      const total = w.reduce((a, b) => a + b, 0);
      let r = ctx.env.rng.next() * total;
      pick = V - 1;
      for (let i = 0; i < V; i++) {
        r -= w[i];
        if (r <= 0) {
          pick = i;
          break;
        }
      }
    }
    return { out: ctx.tape.constant(tensor([1], [pick])) };
  },
});
