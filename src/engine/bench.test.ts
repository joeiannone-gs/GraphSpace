import { describe, expect, it } from 'vitest';
import { DocBuilder } from '@/doc/builder';
import { softmax } from '@/library/builtin';
import { Rng } from './rng';
import { Session } from './session';

/** Single-head causal self-attention at transformer-lesson size, trained with Adam. */
function attentionDoc(B: number, T: number, D: number) {
  const rng = new Rng(3);
  const b = new DocBuilder();
  const x = b.add('value', { value: { shape: [B, T, D], data: Array.from({ length: B * T * D }, () => rng.normal()) } });
  const proj = (label: string) => {
    const w = b.add('parameter', { shape: [D, D], init: 'glorot' }, { label });
    const mm = b.add('matmul');
    b.wire(x, mm, 'a');
    b.wire(w, mm, 'b');
    return mm;
  };
  const q = proj('Wq');
  const k = proj('Wk');
  const v = proj('Wv');
  const kt = b.add('transpose', { perm: [0, 2, 1] });
  b.wire(k, kt, 'x');
  const scores = b.add('matmul');
  b.wire(q, scores, 'a');
  b.wire(kt, scores, 'b');
  const scale = b.add('value', { value: { shape: [], data: [1 / Math.sqrt(D)] } });
  const scaled = b.add('multiply');
  b.wire(scores, scaled, 'a');
  b.wire(scale, scaled, 'b');
  const masked = b.add('causal_mask');
  b.wire(scaled, masked, 'x');
  const sm = b.insert(softmax.build({}));
  b.wire(masked, sm, 'x');
  const att = b.add('matmul');
  b.wire([sm, 'out'], att, 'a');
  b.wire(v, att, 'b');
  const sq = b.add('square');
  b.wire(att, sq, 'x');
  const loss = b.add('mean');
  b.wire(sq, loss, 'x');
  const min = b.add('minimize');
  b.wire(loss, min, 'loss');
  return b.build();
}

describe('speed', () => {
  it('trains one attention block (B=8, T=16, D=32) fast enough for lessons', async () => {
    const s = new Session(async () => new ArrayBuffer(0));
    await s.load(attentionDoc(8, 16, 32));
    s.trainStep();
    const steps = 20;
    const start = performance.now();
    for (let i = 0; i < steps; i++) s.trainStep();
    const perStep = (performance.now() - start) / steps;
    console.log(`attention block: ${perStep.toFixed(2)} ms per training step`);
    expect([...s.errors.values()]).toEqual([]);
    expect(perStep).toBeLessThan(100);
  });
});
