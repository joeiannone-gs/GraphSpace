import { describe, expect, it } from 'vitest';
import { DocBuilder } from '@/doc/builder';
import { parseCsv } from './csv';
import { Session } from './session';

describe('CSV datasets', () => {
  it('reads a header, numbers and answer columns', () => {
    const ds = parseCsv('size,rooms,price\n1,2,3\n4,5,6\n7,8,9', { yColumns: 1, classes: false });
    expect(ds.train.x.shape).toEqual([3, 2]);
    expect(Array.from(ds.train.y.data)).toEqual([3, 6, 9]);
  });

  it('turns class answers into one-hot rows and reports bad rows', () => {
    const ds = parseCsv('0.1,0\n0.9,1\n0.5,2', { yColumns: 1, classes: true });
    expect(ds.train.y.shape).toEqual([3, 3]);
    expect(ds.classes).toBe(3);
    expect(() => parseCsv('1,2\n3', { yColumns: 1, classes: false })).toThrow(/Row 2 has 1 values/);
    expect(() => parseCsv('1,2\n3,x', { yColumns: 1, classes: false })).toThrow(/isn't a number/);
  });

  it('trains on a pasted table', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => `${i / 10},${(2 * i) / 10 + 1}`).join('\n');
    const b = new DocBuilder();
    b.doc.training.lr = 0.05;
    const data = b.add('dataset', { source: 'csv', csv: `x,y\n${rows}`, yColumns: 1 });
    const w = b.add('parameter', { shape: [1, 1] });
    const bias = b.add('parameter', { shape: [1], init: 'zeros' });
    const mm = b.add('matmul');
    b.wire([data, 'x'], mm, 'a');
    b.wire(w, mm, 'b');
    const pred = b.add('add');
    b.wire(mm, pred, 'a');
    b.wire(bias, pred, 'b');
    const diff = b.add('subtract');
    b.wire(pred, diff, 'a');
    b.wire([data, 'y'], diff, 'b');
    const sq = b.add('square');
    b.wire(diff, sq, 'x');
    const mean = b.add('mean');
    b.wire(sq, mean, 'x');
    const min = b.add('minimize');
    b.wire(mean, min, 'loss');
    const s = new Session(async () => new ArrayBuffer(0));
    await s.load(b.build());
    for (let i = 0; i < 600; i++) s.trainStep();
    s.evaluate();
    expect(s.valueOf(w)!.data[0]).toBeCloseTo(2, 1);
  });
});
