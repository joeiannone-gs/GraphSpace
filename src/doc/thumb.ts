/** A tiny picture of a document's top level, stored with projects and commits for thumbnails. */
import { getDef } from '@/nodes/registry';
import type { ProjectDoc } from './types';

/** Nodes as [x, y, r, color] in a 0–100 box; edges as pairs of node indexes. */
export interface Thumb {
  n: [number, number, number, number][];
  e: [number, number][];
}

export const THUMB_COLORS = ['#3d97ff', '#f56305', '#009aa6', '#f1c232', '#b36bff'];

function colorIndex(type: string): number {
  if (type === 'composite') return 2;
  const c = getDef(type)?.category;
  if (c === 'Data' || c === 'Text') return 1;
  if (c === 'Loss' || c === 'Training') return 3;
  if (c === 'Display' || c === 'Diffusion') return 4;
  return 0;
}

export function makeThumb(doc: ProjectDoc): Thumb {
  const nodes = Object.values(doc.nodes).filter((n) => n.parent === null);
  if (!nodes.length) return { n: [], e: [] };
  const xs = nodes.map((n) => n.pos[0]);
  const ys = nodes.map((n) => n.pos[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 1500);
  const scale = 76 / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    n: nodes.map((n) => [
      round(50 + (n.pos[0] - cx) * scale),
      round(50 + (n.pos[1] - cy) * scale),
      round(Math.max(1.5, (n.type === 'composite' ? 450 : 300) * scale)),
      colorIndex(n.type),
    ]),
    e: Object.values(doc.edges)
      .filter((e) => index.has(e.from.node) && index.has(e.to.node))
      .map((e) => [index.get(e.from.node)!, index.get(e.to.node)!]),
  };
}
