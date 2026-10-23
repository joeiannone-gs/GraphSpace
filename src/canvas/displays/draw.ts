/**
 * Canvas2D drawings of live values. Each function draws into a w×h area of a 2D context; the canvas
 * becomes a pixi texture inside the node (and the same drawings can be used in HTML panels).
 */
import type { TensorSnap } from '@/engine/session';

export interface DrawColors {
  text: string;
  muted: string;
  positive: [number, number, number];
  negative: [number, number, number];
  accent: string;
  feedback: string;
}

export const darkDrawColors: DrawColors = {
  text: '#ffffff',
  muted: '#b6bbbf',
  positive: [106, 191, 75],
  negative: [245, 99, 5],
  accent: '#6abf4b',
  feedback: '#f5a623',
};

export const lightDrawColors: DrawColors = {
  text: '#111111',
  muted: '#5c5c66',
  positive: [63, 154, 42],
  negative: [217, 92, 10],
  accent: '#3f9a2a',
  feedback: '#d9820f',
};

const FONT = "'Century Gothic', 'CenturyGothic', Futura, system-ui, sans-serif";

export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? 'NaN' : v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(1).replace('e+', 'e');
  if (Number.isInteger(v)) return String(v);
  return v.toPrecision(a >= 100 ? 4 : 3).replace(/\.?0+$/, '');
}

export function shapeLabel(shape: readonly number[]): string {
  return shape.length === 0 ? 'scalar' : `[${shape.join(' × ')}]`;
}

function heat(v: number, scale: number, c: DrawColors): string {
  const t = scale === 0 ? 0 : Math.max(-1, Math.min(1, v / scale));
  const [r, g, b] = t >= 0 ? c.positive : c.negative;
  return `rgba(${r},${g},${b},${0.12 + 0.88 * Math.abs(t)})`;
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function fitText(ctx: CanvasRenderingContext2D, s: string, maxWidth: number, maxSize: number): number {
  ctx.font = `${maxSize}px ${FONT}`;
  const w = ctx.measureText(s).width;
  return w <= maxWidth ? maxSize : Math.max(8, Math.floor((maxSize * maxWidth) / w));
}

function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const tick = Math.max(4, w * 0.04);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, w * 0.012);
  ctx.beginPath();
  ctx.moveTo(x + tick, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + tick, y + h);
  ctx.moveTo(x + w - tick, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - tick, y + h);
  ctx.stroke();
}

/** Draw a tensor: a number, a row of cells, a grid/heatmap, or a stack of grids for 3-D+. */
export function drawTensor(ctx: CanvasRenderingContext2D, snap: TensorSnap, w: number, h: number, c: DrawColors) {
  const labelH = h * 0.14;
  const areaH = h - labelH;
  const shape = snap.shape;
  const size = shape.reduce((a, b) => a * b, 1);
  text(ctx, shapeLabel(shape) + (snap.truncated ? ' …' : ''), w / 2, h - labelH / 2, labelH * 0.7, c.muted);
  if (size === 1) {
    const s = formatNumber(snap.data[0]);
    text(ctx, s, w / 2, areaH / 2, fitText(ctx, s, w * 0.9, areaH * 0.42), c.text);
    return;
  }
  const scale = Math.max(Math.abs(snap.stats.min), Math.abs(snap.stats.max));
  // Treat as rows × cols of the last two dims; leading dims become stacked layers.
  const cols = shape[shape.length - 1];
  const rows = shape.length >= 2 ? shape[shape.length - 2] : 1;
  const layers = shape.length >= 3 ? shape.slice(0, -2).reduce((a, b) => a * b, 1) : 1;
  const shownLayers = Math.min(layers, 3);
  const offset = shownLayers > 1 ? Math.min(w, areaH) * 0.06 : 0;
  const gw = w * 0.86 - offset * (shownLayers - 1);
  const gh = areaH * 0.84 - offset * (shownLayers - 1);
  for (let layer = shownLayers - 1; layer >= 0; layer--) {
    const x0 = (w - gw) / 2 - offset * ((shownLayers - 1) / 2) + offset * layer;
    const y0 = (areaH - gh) / 2 + offset * ((shownLayers - 1) / 2) - offset * layer;
    drawGrid(ctx, snap, layer * rows * cols, rows, cols, x0, y0, gw, gh, scale, c, layer === 0);
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  snap: TensorSnap,
  base: number,
  rows: number,
  cols: number,
  x0: number,
  y0: number,
  gw: number,
  gh: number,
  scale: number,
  c: DrawColors,
  front: boolean,
) {
  const maxCells = 48;
  const shownRows = Math.min(rows, maxCells);
  const shownCols = Math.min(cols, maxCells);
  const cell = Math.min(gw / shownCols, gh / shownRows);
  const width = cell * shownCols;
  const height = cell * shownRows;
  const x = x0 + (gw - width) / 2;
  const y = y0 + (gh - height) / 2;
  const showNumbers = front && cell >= 22 && shownRows * shownCols <= 36;
  for (let r = 0; r < shownRows; r++) {
    for (let col = 0; col < shownCols; col++) {
      const i = base + r * cols + col;
      if (i >= snap.data.length) {
        ctx.fillStyle = 'rgba(128,128,128,0.15)';
        ctx.fillRect(x + col * cell, y + r * cell, cell, cell);
        continue;
      }
      const v = snap.data[i];
      ctx.fillStyle = heat(v, scale, c);
      ctx.fillRect(x + col * cell + 0.5, y + r * cell + 0.5, cell - 1, cell - 1);
      if (showNumbers) {
        const s = formatNumber(v);
        text(ctx, s, x + (col + 0.5) * cell, y + (r + 0.5) * cell, fitText(ctx, s, cell * 0.86, cell * 0.38), c.text);
      }
    }
  }
  if (front) {
    brackets(ctx, x - 4, y - 2, width + 8, height + 4, c.muted);
    if (rows > shownRows) text(ctx, '⋮', x + width / 2, y + height + cell * 0.4, Math.max(10, cell * 0.6), c.muted);
    if (cols > shownCols) text(ctx, '…', x + width + 14, y + height / 2, Math.max(10, cell * 0.6), c.muted);
  }
}

/** Grayscale images from rows of pixels (784 → 28×28, or any square size). */
export function drawImages(ctx: CanvasRenderingContext2D, snap: TensorSnap, count: number, w: number, h: number, c: DrawColors) {
  const per = snap.shape.length >= 2 ? snap.shape.slice(1).reduce((a, b) => a * b, 1) : snap.data.length;
  const side = Math.round(Math.sqrt(per));
  if (side * side !== per) {
    text(ctx, `Can't draw ${shapeLabel(snap.shape)} as images`, w / 2, h / 2, h * 0.07, c.muted);
    return;
  }
  const available = Math.floor(snap.data.length / per);
  const n = Math.max(1, Math.min(count, available));
  const gridCols = Math.ceil(Math.sqrt(n));
  const gridRows = Math.ceil(n / gridCols);
  const tile = Math.min(w / gridCols, (h * 0.88) / gridRows);
  const img = ctx.createImageData(side, side);
  const { min, max } = snap.stats;
  const range = max - min || 1;
  const scratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(side, side) : null;
  const sctx = scratch?.getContext('2d');
  for (let k = 0; k < n; k++) {
    for (let p = 0; p < per; p++) {
      const v = Math.round(((snap.data[k * per + p] - min) / range) * 255);
      img.data[p * 4] = v;
      img.data[p * 4 + 1] = v;
      img.data[p * 4 + 2] = v;
      img.data[p * 4 + 3] = 255;
    }
    const x = (k % gridCols) * tile + (w - gridCols * tile) / 2;
    const y = Math.floor(k / gridCols) * tile;
    if (sctx && scratch) {
      sctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scratch, x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  text(ctx, shapeLabel(snap.shape), w / 2, h * 0.94, h * 0.08, c.muted);
}

function column(snap: TensorSnap, col: number): number[] {
  const width = snap.shape.length >= 2 ? snap.shape[snap.shape.length - 1] : 1;
  const out: number[] = [];
  for (let i = col; i < snap.data.length; i += width) out.push(snap.data[i]);
  return out;
}

function argmaxRows(snap: TensorSnap): number[] {
  const width = snap.shape[snap.shape.length - 1] ?? 1;
  const out: number[] = [];
  for (let r = 0; r + width <= snap.data.length; r += width) {
    let best = 0;
    for (let j = 1; j < width; j++) if (snap.data[r + j] > snap.data[r + best]) best = j;
    out.push(best);
  }
  return out;
}

const CLASS_COLORS = ['#3d97ff', '#f56305', '#6abf4b', '#b36bff', '#f1c232', '#ff5252', '#00b8d4', '#8d6e63', '#ec407a', '#9e9e9e'];

/**
 * Scatter plot. With 1-column x and y: y against x (predictions overlaid). With 2-column x and
 * one-hot y: the points colored by class (and by predicted class if given, as rings).
 */
export function drawScatter(
  ctx: CanvasRenderingContext2D,
  x: TensorSnap,
  y: TensorSnap,
  pred: TensorSnap | undefined,
  w: number,
  h: number,
  c: DrawColors,
) {
  const pad = Math.min(w, h) * 0.08;
  const twoD = x.shape.length >= 2 && x.shape[x.shape.length - 1] === 2;
  const xs = twoD ? column(x, 0) : Array.from(x.data);
  const ys = twoD ? column(x, 1) : Array.from(y.data);
  const classes = twoD ? argmaxRows(y) : null;
  const preds = pred ? (twoD ? argmaxRows(pred) : Array.from(pred.data)) : null;
  const allY = !twoD && preds ? ys.concat(preds as number[]) : ys;
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...allY), Math.max(...allY)];
  const sx = (v: number) => pad + ((v - minX) / (maxX - minX || 1)) * (w - 2 * pad);
  const sy = (v: number) => h - pad - ((v - minY) / (maxY - minY || 1)) * (h - 2 * pad);
  ctx.strokeStyle = c.muted;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
  const n = Math.min(xs.length, ys.length);
  // Few points (e.g. XOR) get big dots; thousands get small ones.
  const r = Math.min(w, h) * (n <= 20 ? 0.035 : n <= 200 ? 0.015 : 0.008);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = classes ? CLASS_COLORS[classes[i] % CLASS_COLORS.length] : c.accent;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(sx(xs[i]), sy(ys[i]), r, 0, Math.PI * 2);
    ctx.fill();
    if (preds && i < preds.length) {
      ctx.globalAlpha = 0.9;
      if (classes) {
        ctx.strokeStyle = CLASS_COLORS[(preds[i] as number) % CLASS_COLORS.length];
        ctx.lineWidth = r * 0.8;
        ctx.beginPath();
        ctx.arc(sx(xs[i]), sy(ys[i]), r * 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = c.feedback;
        ctx.beginPath();
        ctx.arc(sx(xs[i]), sy(preds[i] as number), r * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** Loss (or any scalar) over time, with the latest value. */
export function drawSparkline(ctx: CanvasRenderingContext2D, values: number[], latest: number | null, label: string, w: number, h: number, c: DrawColors) {
  const top = h * 0.36;
  const s = latest === null ? '—' : formatNumber(latest);
  if (label) text(ctx, label, w / 2, h * 0.07, h * 0.09, c.muted);
  text(ctx, s, w / 2, h * 0.22, fitText(ctx, s, w * 0.9, h * 0.2), c.text);
  if (values.length < 2) return;
  const pad = w * 0.06;
  const finite = values.filter(Number.isFinite);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = top + (1 - (v - min) / (max - min || 1)) * (h - top - pad);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

export function drawMessage(ctx: CanvasRenderingContext2D, message: string, w: number, h: number, color: string) {
  const words = message.split(' ');
  const lines: string[] = [];
  const size = h * 0.075;
  ctx.font = `${size}px ${FONT}`;
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > w * 0.9 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 6);
  shown.forEach((l, i) => text(ctx, l, w / 2, h / 2 + (i - (shown.length - 1) / 2) * size * 1.25, size, color));
}

/** Text in a monospace box, wrapped; shows the end if it doesn't fit. */
export function drawTextBlock(ctx: CanvasRenderingContext2D, content: string, w: number, h: number, c: DrawColors) {
  const size = Math.max(10, Math.round(h * 0.07));
  ctx.font = `${size}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = c.text;
  const pad = w * 0.06;
  const maxWidth = w - 2 * pad;
  const lines: string[] = [];
  for (const para of content.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
    lines.push(line);
  }
  const maxLines = Math.floor((h - 2 * pad) / (size * 1.2));
  const shown = lines.slice(-maxLines);
  shown.forEach((l, i) => ctx.fillText(l, pad, pad + i * size * 1.2));
}
