/** Example projects, written with the builder. Used by the sandbox, the gallery and lessons. */
import { DocBuilder, type Out } from '@/doc/builder';
import type { ProjectDoc } from '@/doc/types';
import { CORPORA, vocabOf } from '@/engine/text';
import { graphConv, layerNorm, linear, mlp, mse, timestepEmbedding, transformerBlock } from '@/library/builtin';

export interface Example {
  slug: string;
  title: string;
  summary: string;
  build(): ProjectDoc;
}

export const fitALine: Example = {
  slug: 'fit-a-line',
  title: 'Fit a line',
  summary: 'Linear regression: learn a slope and an offset that best fit 2-D points.',
  build() {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.05, steps: 300 };
    b.doc.info.description =
      'Each point has an input **x** and an answer **y**. The model predicts `x · w + b`; training adjusts **w** and **b** so the mean squared error gets smaller. Press **Train** and watch the orange predictions line up with the data.';
    const data = b.add('dataset', { source: 'points-2d' }, { label: 'Points' });
    const w = b.add('parameter', { shape: [1, 1] }, { label: 'w' });
    const bias = b.add('parameter', { shape: [1], init: 'zeros' }, { label: 'b' });
    const mm = b.add('matmul', {}, { label: 'x · w' });
    b.wire([data, 'x'], mm, 'a');
    b.wire(w, mm, 'b');
    const pred = b.add('add', {}, { label: 'prediction' });
    b.wire(mm, pred, 'a');
    b.wire(bias, pred, 'b');
    const loss = b.insert(mse.build({}));
    b.wire(pred, loss, 'prediction');
    b.wire([data, 'y'], loss, 'target');
    const min = b.add('minimize');
    b.wire([loss, 'loss'], min, 'loss');
    const plot = b.add('scatter');
    b.wire([data, 'x'], plot, 'x');
    b.wire([data, 'y'], plot, 'y');
    b.wire(pred, plot, 'prediction');
    return b.build();
  },
};

export const xorMlp: Example = {
  slug: 'xor-mlp',
  title: 'XOR with a neural network',
  summary: 'A straight line can’t separate XOR. A small MLP with a hidden layer can.',
  build() {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.05, steps: 400 };
    b.doc.info.description = 'Four points, two classes. Open the **MLP** group to see its two Linear layers and the ReLU between them.';
    const data = b.add('dataset', { source: 'xor' }, { label: 'XOR' });
    const net = b.insert(mlp.build({ inFeatures: 2, hidden: 16, outFeatures: 2 }));
    b.wire([data, 'x'], net, 'x');
    const ce = b.add('softmax_cross_entropy');
    b.wire([net, 'y'], ce, 'logits');
    b.wire([data, 'y'], ce, 'targets');
    const acc = b.add('accuracy');
    b.wire([net, 'y'], acc, 'scores');
    b.wire([data, 'y'], acc, 'targets');
    const min = b.add('minimize');
    b.wire(ce, min, 'loss');
    return b.build();
  },
};

export const mnistClassifier: Example = {
  slug: 'mnist-classifier',
  title: 'Classify handwritten digits',
  summary: 'One Linear layer turns 784 pixels into 10 digit scores.',
  build() {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.01, steps: 100 };
    b.doc.info.description = 'Each image is 28×28 = 784 numbers. The Linear layer learns one weight per pixel per digit.';
    const data = b.add('dataset', { source: 'mnist-200', batchSize: 0 }, { label: 'Digits' });
    const images = b.add('image', { count: 4 });
    b.wire([data, 'x'], images, 'x');
    const layer = b.insert(linear.build({ inFeatures: 784, outFeatures: 10 }));
    b.wire([data, 'x'], layer, 'x');
    const ce = b.add('softmax_cross_entropy');
    b.wire([layer, 'y'], ce, 'logits');
    b.wire([data, 'y'], ce, 'targets');
    const acc = b.add('accuracy');
    b.wire([layer, 'y'], acc, 'scores');
    b.wire([data, 'y'], acc, 'targets');
    const min = b.add('minimize');
    b.wire(ce, min, 'loss');
    return b.build();
  },
};

/** A tiny GPT-style character model: embeddings, transformer blocks, and a generation loop. */
export function buildCharTransformer(opts: { corpus?: string; context?: number; dModel?: number; heads?: number; blocks?: number } = {}) {
  const corpus = opts.corpus ?? 'sonnets';
  const T = opts.context ?? 16;
  const D = opts.dModel ?? 32;
  const V = vocabOf(CORPORA[corpus].text).chars.length;
  const b = new DocBuilder();
  b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.01, steps: 600 };
  b.doc.generate = { steps: 200 };
  b.doc.info.description =
    'A tiny transformer that reads 16 characters and predicts the next one. Double-click **Transformer** to see inside: character and position vectors, a transformer block (open it too), and the scores for every character. Train it, then press **Generate**: each new character is fed back into the text (the dashed orange connection).';
  const text = b.add('text_data', { source: corpus, context: T, batchSize: 8 }, { label: 'Text' });
  const model = b.group('Transformer', (g) => {
    const ids = g.input('ids');
    const table = g.add('parameter', { shape: [V, D], init: 'normal', scale: 0.1 }, { label: 'character vectors' });
    const emb = g.add('embedding');
    g.wire(table, emb, 'table');
    g.wire(ids, emb, 'ids');
    const pos = g.add('parameter', { shape: [T, D], init: 'normal', scale: 0.1 }, { label: 'position vectors' });
    let h: string = g.add('add', {}, { label: 'input' });
    g.wire(emb, h, 'a');
    g.wire(pos, h, 'b');
    let port = 'out';
    for (let i = 0; i < (opts.blocks ?? 1); i++) {
      const block = g.insert(transformerBlock.build({ dModel: D, heads: opts.heads ?? 2 }), { label: `Block ${i + 1}` });
      g.wire([h, port], block, 'x');
      h = block;
      port = 'y';
    }
    const ln = g.insert(layerNorm.build({ dModel: D }));
    g.wire([h, port], ln, 'x');
    const head = g.insert(linear.build({ inFeatures: D, outFeatures: V }), { label: 'scores' });
    g.wire([ln, 'y'], head, 'x');
    g.wire([head, 'y'], g.output('scores'), 'in');
  });
  b.wire([text, 'x'], model, 'ids');
  const ce = b.add('softmax_cross_entropy');
  b.wire([model, 'scores'], ce, 'logits');
  b.wire([text, 'y'], ce, 'targets');
  const min = b.add('minimize');
  b.wire(ce, min, 'loss');
  const sample = b.add('sample', { temperature: 0.7 });
  b.wire([model, 'scores'], sample, 'logits');
  b.wire(sample, text, 'next', 'feedback');
  return b.build();
}

export const charTransformer: Example = {
  slug: 'char-transformer',
  title: 'A tiny transformer',
  summary: 'Learns Shakespeare one character at a time, then writes its own.',
  build: () => buildCharTransformer(),
};

/** Denoising diffusion on 2-D points: learn to predict the noise, then walk from noise back to data. */
export function buildDiffusion2d(opts: { source?: string; steps?: number; hidden?: number } = {}) {
  const K = opts.steps ?? 40;
  const H = opts.hidden ?? 128;
  const b = new DocBuilder();
  b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.003, steps: 3000 };
  b.doc.generate = { steps: K };
  b.doc.info.description =
    'Training adds a random amount of noise to the moons and teaches the **Denoiser** network to predict that noise. **Generate** starts from pure noise and removes the predicted noise one step at a time (the dashed feedback loop), until points that look like the data appear.';
  const data = b.add('dataset', { source: opts.source ?? 'moons', batchSize: 128 }, { label: 'Data' });
  const noise = b.add('diffusion_noise', { steps: K, samples: 400 }, { label: 'Add noise' });
  b.wire([data, 'x'], noise, 'x');
  const net = b.group('Denoiser', (g) => {
    const xt = g.input('xt', 0);
    const t = g.input('t', 1);
    const temb = g.insert(timestepEmbedding.build({ frequencies: 8 }));
    g.wire(t, temb, 't');
    const cat = g.add('concat', { count: 2, axis: -1 });
    g.wire(xt, cat, 'in0');
    g.wire([temb, 'y'], cat, 'in1');
    const l1 = g.insert(linear.build({ inFeatures: 18, outFeatures: H }));
    g.wire(cat, l1, 'x');
    const a1 = g.add('relu');
    g.wire([l1, 'y'], a1, 'x');
    const l2 = g.insert(linear.build({ inFeatures: H, outFeatures: H }));
    g.wire(a1, l2, 'x');
    const a2 = g.add('relu');
    g.wire([l2, 'y'], a2, 'x');
    const l3 = g.insert(linear.build({ inFeatures: H, outFeatures: 2 }));
    g.wire(a2, l3, 'x');
    g.wire([l3, 'y'], g.output('noise'), 'in');
  });
  b.wire([noise, 'xt'], net, 'xt');
  b.wire([noise, 't'], net, 't');
  const loss = b.insert(mse.build({}));
  b.wire([net, 'noise'], loss, 'prediction');
  b.wire([noise, 'noise'], loss, 'target');
  const min = b.add('minimize');
  b.wire([loss, 'loss'], min, 'loss');
  const step = b.add('ddpm_step', { steps: K }, { label: 'Denoise' });
  b.wire([noise, 'xt'], step, 'xt');
  b.wire([net, 'noise'], step, 'eps');
  b.wire([noise, 't'], step, 't');
  b.wire(step, noise, 'prev', 'feedback');
  return b.build();
}

export const diffusion2d: Example = {
  slug: 'diffusion-2d',
  title: 'Diffusion from scratch',
  summary: 'The idea behind image generators, on 2-D points: learn to remove noise, then turn noise into data.',
  build: () => buildDiffusion2d(),
};

/**
 * The classic picture of a neural network: every neuron its own node, every weight its own
 * Parameter (with a chart of its value over training), connections fanning between layers.
 */
export function buildClassicMlp(opts: { sizes?: number[]; source?: string; scale?: number } = {}) {
  const sizes = opts.sizes ?? [2, 4, 4, 2];
  const b = new DocBuilder();
  b.doc.layout = { direction: 'right' };
  // Slow enough to watch every weight's chart move.
  b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.01, steps: 2000 };
  b.doc.info.description =
    'A neural network drawn the classic way: each circle in the middle is one **neuron**. Double-click a neuron to see inside: it multiplies each input by its own weight (θ), adds them up with a bias, and squashes the sum with tanh. Press **Train** and watch every weight’s chart move as the network learns to separate the two moons.';
  const data = b.add('dataset', { source: opts.source ?? 'moons', batchSize: 0 }, { label: 'Moons' });
  let prev: Out[] = Array.from({ length: sizes[0] }, (_, i) => {
    const x = b.add('slice', { spec: `:, ${i}:${i + 1}` }, { label: `x${i + 1}` });
    b.wire([data, 'x'], x, 'x');
    return x;
  });
  sizes.slice(1).forEach((count, li) => {
    const output = li === sizes.length - 2;
    prev = Array.from({ length: count }, (_, j): Out => {
      const inputs = prev;
      const neuron = b.group(output ? `out ${j + 1}` : `h${li + 1}.${j + 1}`, (g) => {
        const ins = inputs.map((_, k) => g.input(`in${k}`, k));
        const products = ins.map((x, k) => {
          const w = g.add('parameter', { shape: [1], init: 'normal', scale: opts.scale ?? 0.8 }, { label: `w${k + 1}` });
          const m = g.add('multiply');
          g.wire(x, m, 'a');
          g.wire(w, m, 'b');
          return m;
        });
        let total: string = products[0];
        for (const p of products.slice(1)) {
          const a = g.add('add');
          g.wire(total, a, 'a');
          g.wire(p, a, 'b');
          total = a;
        }
        const bias = g.add('parameter', { shape: [1], init: 'zeros' }, { label: 'b' });
        const z = g.add('add', {}, { label: 'z' });
        g.wire(total, z, 'a');
        g.wire(bias, z, 'b');
        let result: string = z;
        if (!output) {
          result = g.add('tanh');
          g.wire(z, result, 'x');
        }
        g.wire(result, g.output('y'), 'in');
      });
      inputs.forEach((p, k) => b.wire(p, neuron, `in${k}`));
      return [neuron, 'y'];
    });
  });
  const scores = b.add('concat', { count: prev.length }, { label: 'scores' });
  prev.forEach((p, k) => b.wire(p, scores, `in${k}`));
  const ce = b.add('softmax_cross_entropy');
  b.wire(scores, ce, 'logits');
  b.wire([data, 'y'], ce, 'targets');
  const acc = b.add('accuracy');
  b.wire(scores, acc, 'scores');
  b.wire([data, 'y'], acc, 'targets');
  const min = b.add('minimize');
  b.wire(ce, min, 'loss');
  const plot = b.add('scatter', {}, { label: 'Predictions' });
  b.wire([data, 'x'], plot, 'x');
  b.wire([data, 'y'], plot, 'y');
  b.wire(scores, plot, 'prediction');
  return b.build();
}

export const classicMlp: Example = {
  slug: 'classic-mlp',
  title: 'The classic MLP, neuron by neuron',
  summary: 'Every neuron and every weight on screen: watch each weight’s chart change as the network learns.',
  build: () => buildClassicMlp(),
};

/** A two-layer graph convolutional network that classifies every node from a few labeled ones. */
function gcnModel(b: DocBuilder, label: string, inFeatures: number, hidden: number, classes: number) {
  return b.group(label, (g) => {
    const x = g.input('x', 0);
    const adj = g.input('adj', 1);
    const l1 = g.insert(graphConv.build({ inFeatures, outFeatures: hidden }));
    g.wire(x, l1, 'x');
    g.wire(adj, l1, 'adj');
    const act = g.add('relu');
    g.wire([l1, 'y'], act, 'x');
    const l2 = g.insert(graphConv.build({ inFeatures: hidden, outFeatures: classes }));
    g.wire(act, l2, 'x');
    g.wire(adj, l2, 'adj');
    g.wire([l2, 'y'], g.output('scores'), 'in');
  });
}

/** Loss on the labeled nodes only, accuracy on everyone, and a picture of the predictions. */
function nodeClassificationHead(b: DocBuilder, data: string, scores: Out, prefix = '') {
  const picked = b.add('pick_rows', {}, { label: `${prefix}labeled scores` });
  b.wire(scores, picked, 'x');
  b.wire([data, 'labeled'], picked, 'ids');
  const ce = b.add('softmax_cross_entropy', {}, { label: `${prefix}loss` });
  b.wire(picked, ce, 'logits');
  b.wire([data, 'yLabeled'], ce, 'targets');
  const acc = b.add('accuracy', {}, { label: `${prefix}accuracy` });
  b.wire(scores, acc, 'scores');
  b.wire([data, 'y'], acc, 'targets');
  const plot = b.add('network_plot', {}, { label: `${prefix}prediction` });
  b.wire([data, 'adj'], plot, 'adj');
  b.wire([data, 'pos'], plot, 'pos');
  b.wire(scores, plot, 'color');
  return { ce, acc };
}

export function buildKarateGcn() {
  const b = new DocBuilder();
  b.doc.layout = { direction: 'right' };
  b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.01, steps: 300 };
  b.doc.info.description =
    'In 1977 a university karate club split in two after a dispute between its instructor (**Mr. Hi**) and its administrator (the **Officer**). Wayne Zachary had recorded who was friends with whom. Here only the two leaders are labeled (the ringed nodes); the **graph neural network** has to work out everyone else’s side from the friendships alone. Each Graph Convolution lets a member listen to their friends; two of them reach friends of friends.';
  const data = b.add('graph_data', { source: 'karate' }, { label: 'Karate club' });
  const model = gcnModel(b, 'Graph neural network', 34, 16, 2);
  b.wire([data, 'x'], model, 'x');
  b.wire([data, 'adj'], model, 'adj');
  const { ce } = nodeClassificationHead(b, data, [model, 'scores']);
  const min = b.add('minimize');
  b.wire(ce, min, 'loss');
  return b.build();
}

export function buildCommunitiesGnnVsMlp() {
  const b = new DocBuilder();
  b.doc.layout = { direction: 'right' };
  b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.01, steps: 400 };
  b.doc.info.description =
    'Sixty people in three communities. Each person has a few noisy traits that only *hint* at their community, and only two people per community are labeled. Two models train side by side on the same data: an **MLP** that looks at each person alone, and a **graph neural network** that also listens to their friends. Compare the two accuracies and the two network pictures.';
  const data = b.add('graph_data', { source: 'communities' }, { label: 'Social network' });
  const alone = b.group('MLP (each person alone)', (g) => {
    const x = g.input('x');
    const net = g.insert(mlp.build({ inFeatures: 4, hidden: 16, outFeatures: 3 }));
    g.wire(x, net, 'x');
    g.wire([net, 'y'], g.output('scores'), 'in');
  });
  b.wire([data, 'x'], alone, 'x');
  const gnn = gcnModel(b, 'GNN (uses friendships)', 4, 16, 3);
  b.wire([data, 'x'], gnn, 'x');
  b.wire([data, 'adj'], gnn, 'adj');
  const m = nodeClassificationHead(b, data, [alone, 'scores'], 'MLP ');
  const g = nodeClassificationHead(b, data, [gnn, 'scores'], 'GNN ');
  const total = b.add('add', {}, { label: 'both losses' });
  b.wire(m.ce, total, 'a');
  b.wire(g.ce, total, 'b');
  const min = b.add('minimize');
  b.wire(total, min, 'loss');
  return b.build();
}

export const karateGcn: Example = {
  slug: 'karate-gnn',
  title: 'Karate club: a graph neural network',
  summary: 'Two members are labeled; a GNN infers everyone else’s side from the friendships.',
  build: () => buildKarateGcn(),
};

export const communitiesGnn: Example = {
  slug: 'communities-gnn',
  title: 'Why the graph matters: GNN vs MLP',
  summary: 'Same noisy data, two models: the one that listens to friends wins.',
  build: () => buildCommunitiesGnnVsMlp(),
};

export const examples: Example[] = [fitALine, xorMlp, classicMlp, mnistClassifier, karateGcn, communitiesGnn, charTransformer, diffusion2d];

export function getExample(slug: string): Example | undefined {
  return examples.find((e) => e.slug === slug);
}
