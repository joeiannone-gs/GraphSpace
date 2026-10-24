/** Pure layout math for the canvas: node sizes, port placement and edge routes (world units). */
import type { Vec2 } from '@/doc/types';

export const NODE_RADIUS = 300;
export const PORT_RADIUS = 34;
export const EDGE_WIDTH = 14;

export type Direction = 'up' | 'right';

/** Groups grow with their contents so what's inside stays readable. */
export function groupRadius(childCount: number): number {
  const factor = Math.min(3.5, Math.max(1.25, 0.8 + 0.35 * Math.sqrt(childCount)));
  return NODE_RADIUS * factor;
}

/** Ports sit on the node's circle: inputs on the incoming side, outputs on the outgoing side. */
export function portOffsets(radius: number, count: number, side: 'in' | 'out', direction: Direction): Vec2[] {
  // Angle (screen coords, y down) of the middle of each side.
  const center =
    direction === 'up' ? (side === 'in' ? Math.PI / 2 : -Math.PI / 2) : side === 'in' ? Math.PI : 0;
  const spread = Math.min(Math.PI / 5, (Math.PI * 0.75) / Math.max(count, 1));
  return Array.from({ length: count }, (_, i) => {
    // Order ports left→right (up) or top→bottom (right) as listed.
    const k = i - (count - 1) / 2;
    const sign = direction === 'up' ? (side === 'in' ? -1 : 1) : side === 'in' ? 1 : -1;
    const a = center + sign * k * spread;
    return [Math.cos(a) * radius, Math.sin(a) * radius] as Vec2;
  });
}

// Route in a frame where flow goes along +u: 'up' → u = −y, v = x; 'right' → u = x, v = y.
const toFrame = (p: Vec2, d: Direction): Vec2 => (d === 'up' ? [-p[1], p[0]] : [p[0], p[1]]);
const fromFrame = (q: Vec2, d: Direction): Vec2 => (d === 'up' ? [q[1], -q[0]] : [q[0], q[1]]);

/**
 * Orthogonal route from an output port to an input port. Edges leave outputs and enter inputs
 * along the flow direction; when the target isn't ahead of the source (e.g. feedback loops) the
 * route goes around the side at `detour` distance.
 */
export function routeEdge(
  start: Vec2,
  end: Vec2,
  direction: Direction,
  lane = 0,
  stub = NODE_RADIUS * 0.5,
  detour = NODE_RADIUS * 1.6,
): Vec2[] {
  const [u0, v0] = toFrame(start, direction);
  const [u1, v1] = toFrame(end, direction);
  let pts: Vec2[];
  if (u1 - u0 >= 2 * stub) {
    // `lane` (−1…1) shifts the crossing line so parallel edges don't sit on top of each other.
    const room = (u1 - u0) / 2 - stub;
    const m = (u0 + u1) / 2 + lane * Math.min(room, NODE_RADIUS * 0.6);
    pts = Math.abs(v1 - v0) < 1 ? [[u0, v0], [u1, v1]] : [[u0, v0], [m, v0], [m, v1], [u1, v1]];
  } else {
    const side = Math.max(v0, v1) + detour * (1 + 0.25 * Math.abs(lane));
    pts = [
      [u0, v0],
      [u0 + stub, v0],
      [u0 + stub, side],
      [u1 - stub, side],
      [u1 - stub, v1],
      [u1, v1],
    ];
  }
  return pts.map((q) => fromFrame(q, direction));
}

/** Point and direction a fraction of the way along a polyline (for arrowheads). */
export function pointAlong(points: Vec2[], fraction: number): { at: Vec2; angle: number } {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let target = total * fraction;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const [a, b] = [points[i], points[i + 1]];
      const t = lengths[i] === 0 ? 0 : Math.min(1, target / lengths[i]);
      return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    target -= lengths[i];
  }
  return { at: points[0], angle: 0 };
}

/** Scale and offset that fit points (each with a radius) inside a circle of `containerRadius`. */
export function fitInside(points: { pos: Vec2; r: number }[], containerRadius: number): { scale: number; center: Vec2 } {
  if (points.length === 0) return { scale: 1, center: [0, 0] };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { pos, r } of points) {
    minX = Math.min(minX, pos[0] - r);
    minY = Math.min(minY, pos[1] - r);
    maxX = Math.max(maxX, pos[0] + r);
    maxY = Math.max(maxY, pos[1] + r);
  }
  const center: Vec2 = [(minX + maxX) / 2, (minY + maxY) / 2];
  const halfDiagonal = Math.hypot(maxX - center[0], maxY - center[1]);
  return { scale: Math.min(1, (containerRadius * 0.92) / halfDiagonal), center };
}

function segmentHitsCircle(a: Vec2, b: Vec2, center: Vec2, r: number): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((center[0] - a[0]) * dx + (center[1] - a[1]) * dy) / len2));
  return Math.hypot(center[0] - (a[0] + t * dx), center[1] - (a[1] + t * dy)) < r;
}

/**
 * Straight or right-angled? Automatic mode draws a straight line when it goes forward and clears
 * every node lying between the two ends along the flow; nodes beside the ends (the same layer)
 * don't count, so dense layers fan out with straight lines while long skip connections that would
 * cut through other layers get corners.
 */
export function chooseRoute(
  start: Vec2,
  end: Vec2,
  direction: Direction,
  obstacles: { pos: Vec2; r: number }[],
  style: 'auto' | 'orthogonal' | 'straight' = 'auto',
  ends?: { from: Vec2; to: Vec2 },
): 'straight' | 'orthogonal' {
  if (style !== 'auto') return style;
  const [u0] = toFrame(start, direction);
  const [u1] = toFrame(end, direction);
  if (u1 - u0 < NODE_RADIUS * 0.5) return 'orthogonal';
  const fromU = toFrame(ends?.from ?? start, direction)[0];
  const toU = toFrame(ends?.to ?? end, direction)[0];
  const between = obstacles.filter((o) => {
    const u = toFrame(o.pos, direction)[0];
    return u - o.r * 0.5 > fromU && u + o.r * 0.5 < toU;
  });
  const clear = between.every((o) => !segmentHitsCircle(start, end, o.pos, o.r * 1.08 + EDGE_WIDTH));
  return clear ? 'straight' : 'orthogonal';
}
