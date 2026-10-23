import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseDoc } from '@/doc/schema';
import { builtinGroups } from '@/library/builtin';
import { getDef } from '@/nodes/registry';
import { lessons } from './index';
import { runChecks } from './runner';

const fetchBytes = async (path: string) => {
  const buf = await readFile(`public${path}`);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

describe.each(lessons.map((l) => [l.id, l] as const))('lesson %s', (_id, lesson) => {
  it('lists only real palette entries', () => {
    for (const key of lesson.palette ?? []) {
      if (key.startsWith('group:')) expect(builtinGroups.some((g) => `group:${g.id}` === key), key).toBe(true);
      else expect(getDef(key), key).toBeDefined();
    }
  });

  it('starter fails step 1; each solution passes its step', async () => {
    let doc = parseDoc(lesson.starter());
    const first = await runChecks(lesson.steps[0], doc, fetchBytes);
    expect(first.some((r) => r.status !== 'pass')).toBe(true);
    for (const [i, step] of lesson.steps.entries()) {
      doc = parseDoc(step.solve(doc));
      const results = await runChecks(step, doc, fetchBytes);
      expect(results, `step ${i + 1}: ${step.title}`).toEqual(results.map((r) => ({ ...r, status: 'pass' })));
    }
  });
});
