import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DocBuilder } from '@/doc/builder';
import { EngineHost } from './engineHost';
import type { FromWorker } from './protocol';

const fetchBytes = async (path: string) => {
  const buf = await readFile(`public${path}`);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

function quadratic(steps: number) {
  const b = new DocBuilder();
  b.doc.training = { ...b.doc.training, lr: 0.1, steps };
  const p = b.add('parameter', { shape: [3], init: 'ones' });
  const sq = b.add('square');
  b.wire(p, sq, 'x');
  const mean = b.add('mean');
  b.wire(sq, mean, 'x');
  const min = b.add('minimize');
  b.wire(mean, min, 'loss');
  return { doc: b.build(), p, sq };
}

async function until(messages: FromWorker[], pred: (m: FromWorker) => boolean, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (messages.some(pred)) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('timed out');
}

describe('EngineHost', () => {
  it('evaluates on load, trains to the step budget, and reports done', async () => {
    const messages: FromWorker[] = [];
    const host = new EngineHost(fetchBytes, (m) => messages.push(m));
    const { doc, sq } = quadratic(200);
    await host.handle({ t: 'load', version: 1, doc });
    const first = messages.find((m) => m.t === 'snapshot');
    expect(first && first.t === 'snapshot' && first.snapshot.nodes[sq].status).toBe('ok');
    await host.handle({ t: 'train' });
    await until(messages, (m) => m.t === 'status' && m.state === 'done');
    const last = [...messages].reverse().find((m) => m.t === 'snapshot');
    expect(last?.t === 'snapshot' && last.snapshot.step).toBe(200);
    expect(last?.t === 'snapshot' && last.snapshot.loss).toBeLessThan(0.01);
  });

  it('pauses training when the model changes but not when a node only moves', async () => {
    const messages: FromWorker[] = [];
    const host = new EngineHost(fetchBytes, (m) => messages.push(m));
    const { doc, p } = quadratic(1_000_000);
    await host.handle({ t: 'load', version: 1, doc });
    await host.handle({ t: 'train' });
    const moved = structuredClone(doc);
    moved.nodes[p].pos = [123, 456];
    await host.handle({ t: 'load', version: 2, doc: moved });
    expect(messages.some((m) => m.t === 'status' && m.state === 'paused')).toBe(false);
    const changed = structuredClone(moved);
    changed.nodes[p].params.shape = [4];
    await host.handle({ t: 'load', version: 3, doc: changed });
    const paused = messages.find((m) => m.t === 'status' && m.state === 'paused');
    expect(paused && paused.t === 'status' && paused.notice).toMatch(/model changed/);
    await host.handle({ t: 'pause' });
  });

  it('explains when there is nothing to minimize', async () => {
    const messages: FromWorker[] = [];
    const host = new EngineHost(fetchBytes, (m) => messages.push(m));
    const b = new DocBuilder();
    b.add('value');
    await host.handle({ t: 'load', version: 1, doc: b.build() });
    await host.handle({ t: 'train' });
    await until(messages, (m) => m.t === 'status' && m.state === 'paused');
    const paused = messages.find((m) => m.t === 'status' && m.state === 'paused');
    expect(paused && paused.t === 'status' && paused.notice).toMatch(/Minimize/);
  });
});
