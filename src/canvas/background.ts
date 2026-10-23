/**
 * The infinite isometric grid behind the graph (ported from the original GraphSpace). Three layers
 * of lines fade in and out with zoom so there's always a sense of scale.
 */
import { Graphics } from 'pixi.js';

const MAX_SPACING = 40;
const MIN_SPACING = 10;
const MAX_LINE = 1.5;
const MIN_LINE = 0.5;

const lerp = (v: number, a: number, b: number, c: number, d: number) => ((v - a) / (b - a)) * (d - c) + c;

export class Background {
  readonly g = new Graphics();
  private spacing = 800;

  constructor(private color: number) {
    this.g.eventMode = 'none';
  }

  setColor(color: number) {
    this.color = color;
  }

  /** Redraw for the visible world rectangle at the given zoom. */
  draw(left: number, top: number, right: number, bottom: number, scale: number) {
    const g = this.g;
    g.clear();
    if (!scale || !Number.isFinite(left)) return;
    const onScreen = this.spacing * scale;
    if (onScreen > MAX_SPACING) this.spacing = MIN_SPACING / scale;
    else if (onScreen < MIN_SPACING) this.spacing = MAX_SPACING / scale;
    const absMax = (MAX_SPACING / scale) * 4;
    const absMin = MIN_SPACING / scale;
    for (const s of [this.spacing, this.spacing * 2, this.spacing * 4]) {
      const alpha = Math.max(0.05, Math.min(1, lerp(s, absMin, absMax, 0.1, 1)));
      const width = Math.max(MIN_LINE / scale, lerp(s, absMin, absMax, MIN_LINE / scale, MAX_LINE / scale));
      this.layer(s, width, alpha, left, top, right, bottom);
    }
  }

  private layer(spacing: number, width: number, alpha: number, left: number, top: number, right: number, bottom: number) {
    const g = this.g;
    // A triangular lattice anchored to world coordinates: vertical lines every sx/2 and two
    // families of ±30° lines y = ±x·tan30° + n·spacing.
    const sy = spacing;
    const sx = sy / Math.tan(Math.PI / 6);
    const slope = Math.tan(Math.PI / 6);
    for (let x = Math.floor(left / (sx / 2)) * (sx / 2); x <= right; x += sx / 2) {
      g.moveTo(x, top).lineTo(x, bottom);
    }
    for (const sign of [1, -1]) {
      const c1 = top - Math.max(sign * left * slope, sign * right * slope);
      const c2 = bottom - Math.min(sign * left * slope, sign * right * slope);
      for (let n = Math.floor(Math.min(c1, c2) / sy); n * sy <= Math.max(c1, c2); n++) {
        const c = n * sy;
        g.moveTo(left, sign * left * slope + c).lineTo(right, sign * right * slope + c);
      }
    }
    g.stroke({ width, color: this.color, alpha });
  }
}
