import { describe, expect, it } from 'vitest';
import { parseDoc } from '@/doc/schema';
import { buildDiffusion2d } from '@/gallery/examples';
import { cosineSchedule } from '@/nodes/defs/diffusion';
import { Session } from './session';
import { loadDataset } from './datasets';

/** Mean distance from each sample to its nearest data point. */
function meanNearest(samples: Float64Array, data: Float64Array): number {
  let total = 0;
  const n = samples.length / 2;
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (let j = 0; j < data.length / 2; j++) {
      const d = Math.hypot(samples[2 * i] - data[2 * j], samples[2 * i + 1] - data[2 * j + 1]);
      if (d < best) best = d;
    }
    total += best;
  }
  return total / n;
}

describe('diffusion', () => {
  it('has a sensible noise schedule', () => {
    const { alphaBar, beta } = cosineSchedule(40);
    expect(alphaBar[0]).toBe(1);
    expect(alphaBar[40]).toBeLessThan(0.01);
    for (let t = 1; t <= 40; t++) expect(beta[t]).toBeGreaterThan(0);
  });

  it('learns to turn noise into points on the two moons', async () => {
    const doc = parseDoc(buildDiffusion2d({ steps: 40, hidden: 64 }));
    const s = new Session(async () => new ArrayBuffer(0));
    await s.load(doc);
    expect([...s.errors.values()]).toEqual([]);
    const noise = Object.values(doc.nodes).find((n) => n.type === 'diffusion_noise')!;
    const step = Object.values(doc.nodes).find((n) => n.type === 'ddpm_step')!;

    s.generate(40);
    const data = (await loadDataset('moons', async () => new ArrayBuffer(0))).train.x.data;
    const before = meanNearest(s.valueOf(step.id)!.data, data);

    const t0 = performance.now();
    for (let i = 0; i < 1500; i++) s.trainStep();
    const ms = (performance.now() - t0) / 1500;
    s.generate(40);
    const samples = s.valueOf(step.id)!.data;
    const after = meanNearest(samples, data);
    console.log(`diffusion: nearest-data distance ${before.toFixed(3)} → ${after.toFixed(3)}, loss ${s.lossHistory.at(-1)?.toFixed(3)}, ${ms.toFixed(1)} ms/step`);
    expect(samples.length).toBe(400 * 2);
    expect(after).toBeLessThan(0.12);
    expect(after).toBeLessThan(before / 3);
    expect(noise).toBeTruthy();
  });
});
