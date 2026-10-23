import { z } from 'zod';
import * as O from '@/engine/ops';
import { ShapeError, shapeStr } from '@/engine/tensor';
import { defineNode } from '../types';
import { need, noParams, out, ports } from './helpers';

export const softmaxCrossEntropy = defineNode({
  type: 'softmax_cross_entropy',
  label: 'Softmax Cross-Entropy',
  category: 'Loss',
  explanation:
    'Classification loss. Turns `logits` into probabilities with softmax and measures how surprised the model is by the true `targets` (one-hot rows or class numbers). Averaged over the batch.',
  display: 'value',
  inputs: [
    { name: 'logits', doc: 'scores, shape [batch, classes]' },
    { name: 'targets', doc: 'one-hot [batch, classes] or class ids [batch]' },
  ],
  outputs: out,
  params: noParams,
  fields: [],
  differentiable: true,
  forward: (ctx) => ({ out: O.softmaxCrossEntropy(ctx.tape, need(ctx, 'logits'), need(ctx, 'targets')) }),
});

export const argmax = defineNode({
  type: 'argmax',
  label: 'Argmax',
  category: 'Loss',
  explanation: 'The position of the largest value along an axis — for a classifier, the predicted class.',
  display: 'tensor',
  inputs: ports('x'),
  outputs: out,
  params: z.object({ axis: z.number().int().default(-1) }),
  fields: [{ key: 'axis', label: 'Axis', kind: 'int' }],
  differentiable: false,
  forward: (ctx) => ({ out: O.argmax(ctx.tape, need(ctx, 'x'), ctx.p.axis) }),
});

export const accuracy = defineNode({
  type: 'accuracy',
  label: 'Accuracy',
  category: 'Loss',
  explanation: 'Fraction of examples where the highest score matches the target class. Not trainable — use it to watch progress.',
  display: 'loss',
  inputs: [
    { name: 'scores', doc: 'logits or probabilities [batch, classes]' },
    { name: 'targets', doc: 'one-hot or class ids' },
  ],
  outputs: out,
  params: noParams,
  fields: [],
  differentiable: false,
  forward: (ctx) => ({ out: O.accuracy(ctx.tape, need(ctx, 'scores'), need(ctx, 'targets')) }),
});

export const minimize = defineNode({
  type: 'minimize',
  label: 'Minimize',
  category: 'Training',
  explanation:
    'Marks the **loss**: training nudges every Parameter upstream of this node to make this number smaller. A graph can have one.',
  display: 'loss',
  inputs: [{ name: 'loss', doc: 'a single number' }],
  outputs: [],
  params: noParams,
  fields: [],
  differentiable: true,
  forward: (ctx) => {
    const loss = need(ctx, 'loss');
    if (loss.value.data.length !== 1) {
      throw new ShapeError(`The loss must be a single number, but it has shape ${shapeStr(loss.value.shape)}. Try a Mean node first.`);
    }
    return {};
  },
});
