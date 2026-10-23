/**
 * Train gallery examples ahead of time so they can generate immediately:
 *   npx tsx scripts/pretrain-examples.ts
 * Writes public/examples/<slug>.json (the example document with trained Parameter values).
 */
import fs from 'node:fs';
import { Session } from '@/engine/session';
import { buildCharTransformer } from '@/gallery/examples';
import type { ProjectDoc } from '@/doc/types';

const round = (v: number) => Number(v.toPrecision(5));

async function pretrain(slug: string, doc: ProjectDoc, steps: number) {
  const s = new Session(async () => new ArrayBuffer(0));
  await s.load(doc);
  const t0 = Date.now();
  for (let i = 1; i <= steps; i++) {
    const loss = s.trainStep();
    if (i % 250 === 0) console.log(`${slug}: step ${i} loss ${loss?.toFixed(3)} (${((Date.now() - t0) / i).toFixed(1)} ms/step)`);
  }
  const trained = structuredClone(doc);
  for (const [id, value] of Object.entries(s.paramValues())) {
    trained.nodes[id].params.value = { shape: value.shape, data: value.data.map(round) };
  }
  s.generate(200);
  const textNode = Object.values(trained.nodes).find((n) => n.type === 'text_data');
  if (textNode) console.log(`${slug} sample:\n${s.snapshot().texts[textNode.id]}\n`);
  fs.writeFileSync(`public/examples/${slug}.json`, JSON.stringify(trained));
  console.log(`wrote public/examples/${slug}.json (${(fs.statSync(`public/examples/${slug}.json`).size / 1024).toFixed(0)} KB)`);
}

void pretrain('char-transformer', buildCharTransformer(), 3000);
