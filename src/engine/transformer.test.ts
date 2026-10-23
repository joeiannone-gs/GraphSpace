import { describe, expect, it } from 'vitest';
import { parseDoc } from '@/doc/schema';
import { buildCharTransformer } from '@/gallery/examples';
import { Session } from './session';

describe('char transformer', () => {
  it('learns the alphabet and generates it through the feedback loop', async () => {
    const doc = parseDoc(buildCharTransformer({ corpus: 'abc', context: 8, dModel: 16, heads: 2 }));
    const text = Object.values(doc.nodes).find((n) => n.type === 'text_data')!;
    text.params.prompt = 'abc';
    const sample = Object.values(doc.nodes).find((n) => n.type === 'sample')!;
    sample.params.greedy = true;
    doc.training.lr = 0.02;

    const s = new Session(async () => new ArrayBuffer(0));
    await s.load(doc);
    s.evaluate();
    expect([...s.errors.values()]).toEqual([]);
    const start = s.currentLoss!;
    const t0 = performance.now();
    for (let i = 0; i < 150; i++) s.trainStep();
    const perStep = (performance.now() - t0) / 150;
    s.evaluate();
    console.log(`transformer: loss ${start.toFixed(2)} → ${s.currentLoss!.toFixed(3)}, ${perStep.toFixed(1)} ms/step`);
    expect(s.currentLoss!).toBeLessThan(start * 0.3);

    s.generate(12);
    const generated = s.snapshot().texts[text.id];
    expect(generated.startsWith('abc')).toBe(true);
    expect(generated.length).toBe(3 + 11);
    expect(generated).toContain('defgh');
  });

  it('the gallery example compiles and runs a step', async () => {
    const s = new Session(async () => new ArrayBuffer(0));
    await s.load(parseDoc(buildCharTransformer()));
    expect(s.trainStep()).not.toBeNull();
    expect([...s.errors.values()]).toEqual([]);
  });
});
