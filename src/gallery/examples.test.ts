import { describe, expect, it } from 'vitest';
import { parseDoc } from '@/doc/schema';
import { compile } from '@/engine/compile';
import { Session } from '@/engine/session';
import { buildClassicMlp, examples } from './examples';

describe('gallery examples', () => {
  for (const ex of examples) {
    it(`${ex.slug} is a valid document that compiles without errors`, () => {
      const doc = parseDoc(ex.build());
      expect([...compile(doc).errors.values()]).toEqual([]);
    });
  }
});

describe('classic MLP', () => {
  it('learns the two moons with every weight as its own node', async () => {
    const doc = parseDoc(buildClassicMlp());
    expect(Object.values(doc.nodes).filter((n) => n.type === 'parameter')).toHaveLength(2 * 4 + 4 * 4 + 4 * 2 + 4 + 4 + 2);
    const acc = Object.values(doc.nodes).find((n) => n.type === 'accuracy')!;
    const s = new Session(async () => new ArrayBuffer(0));
    await s.load(doc);
    for (let i = 0; i < doc.training.steps; i++) s.trainStep();
    s.evaluate();
    expect(s.valueOf(acc.id)!.data[0]).toBeGreaterThan(0.95);
  });
});
