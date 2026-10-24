import { describe, expect, it } from 'vitest';
import { EDGE_WIDTH, fitInside, pointAlong, portOffsets, routeEdge, routePath } from './geometry';

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

describe('automatic edge routes', () => {
  it('goes straight when clear, with corners around nodes or backwards', async () => {
    const { chooseRoute } = await import('./geometry');
    // up flow: forward and clear → straight
    expect(chooseRoute([0, 0], [800, -2000], 'up', [])).toBe('straight');
    // a node sitting on the straight line → corners
    expect(chooseRoute([0, 0], [0, -3000], 'up', [{ pos: [0, -1500], r: 300 }])).toBe('orthogonal');
    // target behind the source → corners
    expect(chooseRoute([0, -2000], [0, 0], 'up', [])).toBe('orthogonal');
    // a neighbour in the same layer as the target doesn't block a fan line
    const neighbour = { pos: [500, -1300] as [number, number], r: 500 };
    expect(chooseRoute([0, 0], [900, -1000], 'up', [neighbour], 'auto', { from: [0, 300], to: [900, -1300] })).toBe('straight');
    // a forced style wins
    expect(chooseRoute([0, 0], [0, -3000], 'up', [{ pos: [0, -1500], r: 300 }], 'straight')).toBe('straight');
  });
});

describe('edge paths', () => {
  const clearOf = (pts: [number, number][], c: [number, number], r: number) =>
    pts.every((p, i) => {
      if (i === 0) return true;
      const a = pts[i - 1];
      for (let t = 0; t <= 1; t += 0.01) {
        if (Math.hypot(a[0] + (p[0] - a[0]) * t - c[0], a[1] + (p[1] - a[1]) * t - c[1]) < r) return false;
      }
      return true;
    });

  it('goes around a node in the way instead of through it', () => {
    // up flow: a group sits right across both columns the plain route would use
    const group = { pos: [0, -1500] as [number, number], r: 600 };
    const plain = routeEdge([100, 0], [-100, -3000], 'up');
    expect(clearOf(plain, group.pos, group.r)).toBe(false);
    const pts = routePath([100, 0], [-100, -3000], 'up', { obstacles: [group], style: 'orthogonal' });
    expect(clearOf(pts, group.pos, group.r + EDGE_WIDTH)).toBe(true);
    expect(pts[0]).toEqual([100, 0]);
    expect(pts[pts.length - 1]).toEqual([-100, -3000]);
    for (let i = 1; i < pts.length; i++) expect(pts[i - 1][0] === pts[i][0] || pts[i - 1][1] === pts[i][1]).toBe(true);
  });

  it('loops feedback around, and goes straight to a gate that is not ahead', () => {
    expect(routePath([0, -2000], [0, 0], 'up', { feedback: true })).toHaveLength(6);
    expect(routePath([0, 0], [50, -100], 'up', { direct: true, style: 'orthogonal' })).toEqual([[0, 0], [50, -100]]);
  });

  it('pads contents away from the walls along the flow', () => {
    const kids = [{ pos: [0, 0] as [number, number], r: 300 }];
    expect(fitInside(kids, 300, [0, 300]).scale).toBeLessThan(fitInside(kids, 300).scale);
  });
});
