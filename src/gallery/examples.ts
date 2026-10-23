/** Example projects, written with the builder. Used by the sandbox, the gallery and lessons. */
import { DocBuilder } from '@/doc/builder';
import type { ProjectDoc } from '@/doc/types';
import { linear, mlp, mse } from '@/library/builtin';

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

export const examples: Example[] = [fitALine, xorMlp, mnistClassifier];

export function getExample(slug: string): Example | undefined {
  return examples.find((e) => e.slug === slug);
}
