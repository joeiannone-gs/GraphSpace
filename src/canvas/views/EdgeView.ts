/** The pixi display of one edge: an orthogonal route with an arrowhead (dashed for feedback). */
import { Graphics } from 'pixi.js';
import type { DocEdge, Vec2 } from '@/doc/types';
import { Direction, EDGE_WIDTH, pointAlong, routeEdge } from '../geometry';
import type { CanvasTheme } from '../theme';

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export class EdgeView {
  readonly g = new Graphics();
  private points: Vec2[] = [];

  /** A stable per-edge offset in [−1, 1] so parallel routes spread out. */
  private readonly lane: number;

  constructor(public edge: DocEdge) {
    let h = 0;
    for (let i = 0; i < edge.id.length; i++) h = (h * 31 + edge.id.charCodeAt(i)) | 0;
    this.lane = ((Math.abs(h) % 9) - 4) / 4;
    this.g.label = `edge:${edge.id}`;
    this.g.eventMode = 'static';
    this.g.cursor = 'pointer';
    this.g.hitArea = {
      contains: (x: number, y: number) =>
        this.points.some((p, i) => i > 0 && distanceToSegment([x, y], this.points[i - 1], p) < EDGE_WIDTH * 2.5),
    };
  }

  draw(start: Vec2, end: Vec2, direction: Direction, theme: CanvasTheme, opts: { selected: boolean; gradient: number | null }) {
    const feedback = this.edge.kind === 'feedback';
    this.points = routeEdge(start, end, direction, this.lane);
    const g = this.g;
    g.clear();
    if (opts.gradient !== null && !feedback) {
      this.strokePath(g);
      g.stroke({ color: theme.gradient, width: EDGE_WIDTH * (1.6 + 3 * opts.gradient), alpha: 0.25 + 0.5 * opts.gradient, join: 'round', cap: 'round' });
    }
    const color = opts.selected ? theme.selected : feedback ? theme.feedback : theme.edge;
    if (feedback) {
      this.dashPath(g, EDGE_WIDTH * 3, EDGE_WIDTH * 2);
      g.stroke({ color, width: EDGE_WIDTH, cap: 'butt' });
    } else {
      this.strokePath(g);
      g.stroke({ color, width: EDGE_WIDTH, join: 'round' });
    }
    const { at, angle } = pointAlong(this.points, 0.82);
    const size = EDGE_WIDTH * 3.2;
    g.poly([
      at[0] + Math.cos(angle) * size,
      at[1] + Math.sin(angle) * size,
      at[0] + Math.cos(angle + 2.5) * size,
      at[1] + Math.sin(angle + 2.5) * size,
      at[0] + Math.cos(angle - 2.5) * size,
      at[1] + Math.sin(angle - 2.5) * size,
    ]).fill({ color });
  }

  private strokePath(g: Graphics) {
    g.moveTo(this.points[0][0], this.points[0][1]);
    for (const p of this.points.slice(1)) g.lineTo(p[0], p[1]);
  }

  private dashPath(g: Graphics, dash: number, gap: number) {
    for (let i = 1; i < this.points.length; i++) {
      const [a, b] = [this.points[i - 1], this.points[i]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / (len || 1);
      const uy = (b[1] - a[1]) / (len || 1);
      for (let d = 0; d < len; d += dash + gap) {
        const e = Math.min(len, d + dash);
        g.moveTo(a[0] + ux * d, a[1] + uy * d);
        g.lineTo(a[0] + ux * e, a[1] + uy * e);
      }
    }
  }

  destroy() {
    this.g.destroy();
  }
}
