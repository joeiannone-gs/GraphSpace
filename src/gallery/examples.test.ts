import { describe, expect, it } from 'vitest';
import { parseDoc } from '@/doc/schema';
import { compile } from '@/engine/compile';
import { Session } from '@/engine/session';
import { readFile } from 'node:fs/promises';
import { buildClassicMlp, buildCommunitiesGnnVsMlp, buildKarateGcn, examples } from './examples';

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

const fetchBytes = async (path: string) => {
  const buf = await readFile(`public${path}`);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

async function trainedAccuracies(doc: ReturnType<typeof buildKarateGcn>) {
  const s = new Session(fetchBytes);
  await s.load(parseDoc(doc));
  for (let i = 0; i < doc.training.steps; i++) s.trainStep();
  s.evaluate();
  expect([...s.errors.values()]).toEqual([]);
  return Object.fromEntries(Object.values(doc.nodes).filter((n) => n.type === 'accuracy').map((n) => [n.label, s.valueOf(n.id)!.data[0]]));
}

describe('graph neural networks', () => {
  it('karate club: two labeled leaders are enough to place nearly everyone', async () => {
    const acc = await trainedAccuracies(buildKarateGcn());
    expect(acc.accuracy).toBeGreaterThan(0.9);
  });

  it('communities: the GNN beats an MLP on the same noisy features', async () => {
    const acc = await trainedAccuracies(buildCommunitiesGnnVsMlp());
    expect(acc['GNN accuracy']).toBeGreaterThan(0.75);
    expect(acc['GNN accuracy'] - acc['MLP accuracy']).toBeGreaterThan(0.25);
  });
});
