import { describe, expect, it } from 'vitest';
import { fitInside, pointAlong, portOffsets, routeEdge } from './geometry';

describe('canvas geometry', () => {
  it('places inputs below and outputs above when flowing up', () => {
    const ins = portOffsets(100, 2, 'in', 'up');
    const outs = portOffsets(100, 1, 'out', 'up');
    for (const [, y] of ins) expect(y).toBeGreaterThan(0);
    expect(outs[0][1]).toBeCloseTo(-100);
    expect(ins[0][0]).toBeLessThan(ins[1][0]);
  });

  it('routes forward edges with right angles and backward edges around the side', () => {
    const forward = routeEdge([0, 0], [500, -3000], 'up');
    expect(forward).toHaveLength(4);
    for (let i = 1; i < forward.length; i++) {
      const [a, b] = [forward[i - 1], forward[i]];
      expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
    }
    const back = routeEdge([0, -2000], [0, 0], 'up');
    expect(back).toHaveLength(6);
    expect(back[2][0]).toBeGreaterThan(0);
  });

  it('finds points along a path and fits children in a circle', () => {
    const mid = pointAlong([[0, 0], [10, 0], [10, 10]], 0.5);
    expect(mid.at).toEqual([10, 0]);
    const fit = fitInside([{ pos: [-1000, 0], r: 300 }, { pos: [1000, 0], r: 300 }], 300);
    expect(fit.center).toEqual([0, 0]);
    expect(fit.scale).toBeLessThan(0.3);
  });
});
